import { json } from 'overmind';
import type { Context } from '../index';
import type { Application } from '../types';
import { createDocument } from '../factories';
import type { DocumentDatabase } from './documentDatabase';
import {
    PERSISTENCE_KEY,
    SCHEMA_VERSION,
    migratePersistedState,
    readView,
    restoreDocuments
} from './documentStorage';
import { TabSync } from './tabSync';

/** Where this device keeps its view: the document it shows, and each document's camera. */
export const VIEW_KEY = `${PERSISTENCE_KEY}:view`;

/** A fingerprint of the local storage save as it was moved into the database. */
export const MIGRATED_KEY = `${PERSISTENCE_KEY}:migrated`;

/** Saved updates a document gathers before they are merged into one. */
const COMPACT_AFTER = 100;

type Instance = Pick<Context, 'state' | 'actions' | 'addMutationListener'>;

const viewOf = ({
    currentDocumentId,
    documents
}: Pick<Application, 'currentDocumentId' | 'documents'>) => ({
    currentDocumentId,
    cameras: Object.fromEntries(
        Object.values(documents).map(({ id, camera }) => [id, json(camera)])
    )
});

/** A short, stable fingerprint of `text` (FNV-1a). */
function fingerprint(text: string): string {
    let hash = 0x811c9dc5;

    for (let index = 0; index < text.length; index++) {
        hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193);
    }

    return `${text.length}:${(hash >>> 0).toString(36)}`;
}

/** Loads the local storage save into the store; returns false when it cannot be saved on. */
function loadLocalData({ effects, state, actions }: Context): boolean {
    try {
        const raw = effects.loadState(PERSISTENCE_KEY);

        if (raw === undefined) {
            return true;
        }

        let repaired = false;
        const persisted = migratePersistedState(raw, () => {
            repaired = true;
        });

        if (!persisted) {
            effects.backupState(PERSISTENCE_KEY);
            actions.displayError(
                'Saved data could not be loaded. The original is preserved; autosave is disabled for this session.'
            );

            return false;
        }

        if (
            repaired ||
            (typeof raw === 'object' &&
                raw !== null &&
                'version' in raw &&
                raw.version !== SCHEMA_VERSION)
        ) {
            effects.backupState(PERSISTENCE_KEY);
        }

        state.documents = restoreDocuments(persisted);
        state.currentDocumentId = persisted.currentDocumentId;

        return true;
    } catch {
        actions.displayError(
            'Saved data could not be read or backed up. The original is preserved; autosave is disabled for this session.'
        );

        return false;
    }
}

/**
 * Loads the saved documents, then saves this copy's changes and shares them with
 * the other copies open on the device. Documents are saved in IndexedDB, each on its
 * own; the first time, the local storage save is backed up and moved there. A
 * document that fails to load is left as saved, and the view is saved per device.
 * Other copies' messages are only taken once loading is done; what they sent
 * meanwhile is picked up from the database and by catching up.
 */
export async function startDocumentSync(context: Context, instance: Instance): Promise<void> {
    const { state, effects } = context;
    const { collaboration } = effects;
    const { displayError, addDocument, discardDocument, removeDocument, applyRemoteChanges } =
        instance.actions;
    /** Documents in the database, so their changes are saved. */
    const saved = new Set<string>();
    /** Documents deleted here, which a late read of the database must not bring back. */
    const deletedHere = new Set<string>();
    /** Documents added or deleted since the last reconcile. */
    const touched = new Set<string>();
    /** Documents created while loading, shared once other copies are listened to. */
    const unannounced: string[] = [];
    const appended = new Map<string, number>();
    let database: DocumentDatabase | undefined = undefined;
    let sync: TabSync | undefined = undefined;
    let saving = false;
    let failing = false;
    let viewTimer: ReturnType<typeof setTimeout> | undefined;
    let reconcileQueued = false;
    let loaded = false;

    const isOpen = (documentId: string) => collaboration.documentIds().includes(documentId);

    const store = (write: () => Promise<void>) =>
        write().then(
            () => {
                failing = false;
            },
            () => {
                if (!failing) {
                    displayError(
                        'Could not save your changes. Storage may be full or unavailable.'
                    );
                }

                failing = true;
            }
        );

    const compact = (documentId: string) => {
        const target = database;

        if (!target || !saving) {
            return;
        }

        void store(() =>
            target.compact(documentId, (updates) =>
                collaboration.merge(
                    isOpen(documentId) ? [...updates, collaboration.state(documentId)] : updates
                )
            )
        );
    };

    const append = (documentId: string, update: Uint8Array) => {
        const target = database;

        if (!target || !saving || !saved.has(documentId)) {
            return;
        }

        const count = (appended.get(documentId) ?? 0) + 1;

        void store(() => target.append(documentId, update));
        appended.set(documentId, count % COMPACT_AFTER);

        if (count === COMPACT_AFTER) {
            compact(documentId);
        }
    };

    /** Opens a saved or shared document from its updates; one that cannot be read stays out. */
    const openSaved = (documentId: string, updates: Uint8Array[]): boolean => {
        addDocument({ id: documentId });

        try {
            collaboration.open(documentId, collaboration.merge(updates));
            saved.add(documentId);

            return true;
        } catch {
            collaboration.close(documentId);
            discardDocument(documentId);

            return false;
        }
    };

    const removeShared = (documentId: string) => {
        collaboration.close(documentId);
        saved.delete(documentId);
        removeDocument(documentId);
    };

    /** Starts sharing and saving a document this copy made. */
    const create = (documentId: string) => {
        collaboration.open(documentId);

        const update = collaboration.state(documentId);
        const target = database;

        if (target && saving) {
            saved.add(documentId);
            void store(() =>
                target.create(documentId, update).catch((error: unknown) => {
                    saved.delete(documentId);
                    throw error;
                })
            );
        }

        if (sync) {
            sync.sendDocument(documentId, update);
        } else {
            unannounced.push(documentId);
        }
    };

    /**
     * Shares and saves the documents this copy added or deleted. Additions go first,
     * so a copy told of a deletion already has the document that replaced it.
     */
    const reconcile = () => {
        reconcileQueued = false;

        const documentIds = [...touched];
        const inStore = (documentId: string) => Object.hasOwn(instance.state.documents, documentId);

        touched.clear();
        documentIds
            .filter((documentId) => inStore(documentId) && !isOpen(documentId))
            .forEach(create);

        for (const documentId of documentIds) {
            if (inStore(documentId) || !isOpen(documentId)) {
                continue;
            }

            collaboration.close(documentId);
            deletedHere.add(documentId);

            const target = database;

            if (saved.delete(documentId) && target && saving) {
                void store(() => target.remove(documentId));
            }

            sync?.sendDeleted(documentId);
        }
    };

    /** Picks up documents other copies created or deleted while this copy missed messages. */
    const refresh = async () => {
        const target = database;

        if (!target) {
            return;
        }

        const known = new Set(saved);
        const savedIds = new Set(await target.documentIds());

        [...known]
            .filter((documentId) => !savedIds.has(documentId) && isOpen(documentId))
            .forEach(removeShared);

        for (const documentId of savedIds) {
            if (isOpen(documentId) || deletedHere.has(documentId)) {
                continue;
            }

            const updates = await target.load(documentId).catch(() => undefined);

            if (updates && !isOpen(documentId) && !deletedHere.has(documentId)) {
                openSaved(documentId, updates);
            }
        }
    };

    const catchUp = () =>
        refresh()
            .catch(() => undefined)
            .then(() => sync?.catchUp());

    const saveView = () => {
        clearTimeout(viewTimer);
        viewTimer = undefined;

        if (!instance.state.config.autoSave) {
            return;
        }

        try {
            effects.saveState(VIEW_KEY, viewOf(instance.state));
        } catch {
            // The view is a convenience; documents are saved on their own.
        }
    };

    /** The local storage save's fingerprint, if there is one. */
    const localSave = () => {
        try {
            const raw = effects.loadState(PERSISTENCE_KEY);

            return raw === undefined ? undefined : fingerprint(JSON.stringify(raw));
        } catch {
            return undefined;
        }
    };

    /** Moves the local storage save into the store, to be saved in the database. */
    const migrate = () => {
        const moved = localSave();

        try {
            if (saving) {
                effects.backupState(PERSISTENCE_KEY);
            }
        } catch {
            saving = false;
        }

        saving = loadLocalData(context) && saving;

        if (saving && moved) {
            effects.saveState(MIGRATED_KEY, moved);
        }
    };

    /** Tells the user once when an older build saved to local storage after the move. */
    const noticeOlderSaves = () => {
        const current = localSave();

        try {
            if (current === undefined || current === effects.loadState(MIGRATED_KEY)) {
                return;
            }

            displayError(
                'An older version of the editor saved changes after your documents moved. They are not shown here; the save is kept in this browser.'
            );

            if (saving) {
                effects.saveState(MIGRATED_KEY, current);
            }
        } catch {
            // Nothing to compare against: the documents shown are the saved ones.
        }
    };

    const load = async (target: DocumentDatabase, documentIds: string[]) => {
        let failed = 0;

        state.documents = {};

        for (const documentId of documentIds) {
            const updates = await target.load(documentId).catch(() => undefined);

            if (!updates || !openSaved(documentId, updates)) {
                failed++;
                continue;
            }

            if (updates.length > COMPACT_AFTER) {
                compact(documentId);
            }
        }

        if (failed > 0) {
            displayError('A saved document could not be loaded. It is kept as it was saved.');
        }

        noticeOlderSaves();
    };

    // Registered before loading reads derived state: Overmind drops a derived value's
    // listener while it calls listeners, which skips the listener after the dropped one.
    instance.addMutationListener(({ path, delimiter }) => {
        if (!loaded) {
            return;
        }

        const [root, documentId, field] = path.split(delimiter);

        if (root === 'currentDocumentId' || (root === 'documents' && field === 'camera')) {
            clearTimeout(viewTimer);
            viewTimer = setTimeout(saveView, 500);
        }

        if (root !== 'documents' || field !== undefined) {
            return;
        }

        const documentIds = documentId
            ? [documentId]
            : [...Object.keys(instance.state.documents), ...collaboration.documentIds()];

        documentIds.forEach((id) => touched.add(id));

        if (!reconcileQueued) {
            reconcileQueued = true;
            queueMicrotask(reconcile);
        }
    });

    const [opened] = await Promise.all([
        effects.openDocumentDatabase().catch(() => undefined),
        collaboration.initialize({
            getDocument: (documentId) => instance.state.documents[documentId],
            applyRemoteChanges,
            addMutationListener: instance.addMutationListener,
            sendUpdate: (documentId, update) => {
                sync?.send(documentId, update);
                append(documentId, update);
            }
        })
    ]);

    database = opened;
    saving = state.config.autoSave && database !== undefined;

    if (state.config.autoSave && !database) {
        displayError('Documents cannot be saved in this browser. Changes made here are not kept.');
    }

    const savedIds = database ? await database.documentIds().catch(() => undefined) : [];

    if (!savedIds) {
        // Reading the database failed: show a new document, and write nothing over the saved ones.
        saving = false;
        displayError(
            'Saved documents could not be read. They are kept as saved; changes made here are not kept.'
        );
    }

    if (database && savedIds && savedIds.length > 0) {
        await load(database, savedIds);
    } else if (savedIds) {
        migrate();
    }

    if (Object.keys(state.documents).length === 0) {
        const document = createDocument();

        state.documents[document.id] = document;
    }

    Object.keys(state.documents)
        .filter((documentId) => !isOpen(documentId))
        .forEach(create);

    let view = readView(undefined);

    try {
        view = readView(effects.loadState(VIEW_KEY));
    } catch {
        // An unreadable view shows the first document, with its saved camera.
    }

    Object.entries(view.cameras)
        .filter(([documentId]) => Object.hasOwn(state.documents, documentId))
        .forEach(([documentId, camera]) => {
            state.documents[documentId].camera = camera;
        });

    if (view.currentDocumentId && Object.hasOwn(state.documents, view.currentDocumentId)) {
        state.currentDocumentId = view.currentDocumentId;
    } else if (!Object.hasOwn(state.documents, state.currentDocumentId)) {
        state.currentDocumentId = Object.keys(state.documents)[0];
    }

    loaded = true;

    sync = new TabSync(collaboration, effects.openChannel(), {
        created: (documentId, update) => openSaved(documentId, [update]),
        deleted: removeShared
    });
    unannounced.splice(0).forEach((documentId) => sync?.sendDocument(documentId));

    if (typeof window !== 'undefined') {
        window.addEventListener('pagehide', () => {
            collaboration.flush();
            saveView();
        });
        sync.listen(window, () => void catchUp());
    }

    await catchUp();
}
