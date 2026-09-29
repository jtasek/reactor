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
    restoreDocuments,
    type View
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
    const {
        displayError,
        setSaveStatus,
        addDocument,
        discardDocument,
        removeDocument,
        applyRemoteChanges
    } = instance.actions;
    /** Documents in the database, so their changes are saved. */
    const saved = new Set<string>();
    /** Documents seen in the database, so one missing from it later was deleted elsewhere. */
    const confirmed = new Set<string>();
    /** Documents deleted here, which a late read of the database must not bring back. */
    const deletedHere = new Set<string>();
    /** Documents added or deleted since the last reconcile. */
    const touched = new Set<string>();
    /** Documents created while loading, and their state, shared once other copies listen. */
    const unannounced: Array<[string, Uint8Array]> = [];
    const appended = new Map<string, number>();
    let database: DocumentDatabase | undefined = undefined;
    let sync: TabSync | undefined = undefined;
    /** Why this copy saves nothing, while it does not. */
    let notSaving: string | undefined = 'Documents are loading.';
    /**
     * Per document, the number of a write that failed, so the database lacks changes
     * of it until a later write saves it whole.
     */
    const unsaved = new Map<string, number>();
    /** Per document, the number of the last write that saved it whole. */
    const savedWhole = new Map<string, number>();
    let written = 0;
    let pending = 0;
    let viewTimer: ReturnType<typeof setTimeout> | undefined;
    let reconcileQueued = false;

    const isOpen = (documentId: string) => collaboration.documentIds().includes(documentId);

    const report = () => {
        const reason =
            notSaving ??
            (unsaved.size > 0
                ? 'Changes could not be saved. Storage may be full or unavailable.'
                : undefined);

        setSaveStatus(
            reason ? { kind: 'notSaving', reason } : { kind: pending > 0 ? 'saving' : 'saved' }
        );
    };

    /**
     * Runs a write for a document. One that `completes` it saves the document whole,
     * making up for writes started before it that failed.
     */
    const store = (documentId: string, write: () => Promise<void>, completes = false) => {
        const number = ++written;

        pending++;
        report();

        return write()
            .then(
                () => {
                    if (!completes) {
                        return;
                    }

                    savedWhole.set(documentId, Math.max(savedWhole.get(documentId) ?? 0, number));

                    if ((unsaved.get(documentId) ?? number) < number) {
                        unsaved.delete(documentId);
                    }
                },
                () => {
                    if (number > (savedWhole.get(documentId) ?? 0)) {
                        unsaved.set(documentId, Math.max(unsaved.get(documentId) ?? 0, number));
                    }
                }
            )
            .finally(() => {
                pending--;
                report();
            });
    };

    const compact = (documentId: string) => {
        const target = database;

        if (!target || notSaving) {
            return;
        }

        void store(documentId, () =>
            target.compact(documentId, (updates) =>
                collaboration.merge(
                    isOpen(documentId) ? [...updates, collaboration.state(documentId)] : updates
                )
            )
        );
    };

    /** Saves a document's whole state: as a new document, or added to its saved updates. */
    const saveWhole = (documentId: string, update: Uint8Array) => {
        const target = database;

        if (!target || notSaving) {
            return;
        }

        if (saved.has(documentId)) {
            void store(documentId, () => target.append(documentId, update), true);

            return;
        }

        saved.add(documentId);
        void store(
            documentId,
            () =>
                target.create(documentId, update).then(
                    () => {
                        confirmed.add(documentId);
                    },
                    (error: unknown) => {
                        saved.delete(documentId);
                        throw error;
                    }
                ),
            true
        );
    };

    const append = (documentId: string, update: Uint8Array) => {
        const target = database;

        if (!target || notSaving) {
            return;
        }

        if (unsaved.has(documentId)) {
            saveWhole(documentId, collaboration.state(documentId));

            return;
        }

        if (!saved.has(documentId)) {
            return;
        }

        const count = (appended.get(documentId) ?? 0) + 1;

        void store(documentId, () => target.append(documentId, update));
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
        unsaved.delete(documentId);
        savedWhole.delete(documentId);
        confirmed.delete(documentId);
        removeDocument(documentId);
    };

    /** Starts sharing and saving a document this copy made. */
    const create = (documentId: string) => {
        collaboration.open(documentId);

        const update = collaboration.state(documentId);

        saveWhole(documentId, update);

        if (sync) {
            sync.sendDocument(documentId, update);
        } else {
            unannounced.push([documentId, update]);
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
            confirmed.delete(documentId);
            unsaved.delete(documentId);
            savedWhole.delete(documentId);

            const target = database;

            if (saved.delete(documentId) && target && !notSaving) {
                void store(documentId, () => target.remove(documentId), true);
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

        const known = new Set(confirmed);
        const savedIds = new Set(await target.documentIds());

        [...known]
            .filter((documentId) => !savedIds.has(documentId) && isOpen(documentId))
            .forEach(removeShared);
        savedIds.forEach((documentId) => {
            if (isOpen(documentId)) {
                confirmed.add(documentId);
            }
        });

        for (const documentId of savedIds) {
            if (isOpen(documentId) || deletedHere.has(documentId)) {
                continue;
            }

            const updates = await target.load(documentId).catch(() => undefined);

            if (updates && !isOpen(documentId) && !deletedHere.has(documentId)) {
                if (openSaved(documentId, updates)) {
                    confirmed.add(documentId);
                }
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

    /** Records the local storage save the documents shown already account for. */
    const remember = (value: string) => {
        try {
            effects.saveState(MIGRATED_KEY, value);
        } catch {
            // Without the record, the next start mentions the local storage save again.
        }
    };

    /** Moves the local storage save into the store, to be saved in the database. */
    const migrate = () => {
        const moved = localSave();

        try {
            if (!notSaving) {
                effects.backupState(PERSISTENCE_KEY);
            }
        } catch {
            notSaving = 'Saved data could not be backed up, so changes made here are not saved.';
        }

        if (!loadLocalData(context)) {
            notSaving ??= 'Saved data could not be loaded, so changes made here are not saved.';
        }

        if (!notSaving && moved) {
            remember(moved);
        }
    };

    /** Tells the user once when an older build saved to local storage after the move. */
    const noticeOlderSaves = () => {
        const current = localSave();
        let recorded: unknown;

        try {
            recorded = effects.loadState(MIGRATED_KEY);
        } catch {
            recorded = undefined;
        }

        if (current === undefined || current === recorded) {
            return;
        }

        displayError(
            'An older version of the editor saved changes after your documents moved. They are not shown here; the save is kept in this browser.'
        );
        remember(current);
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

            confirmed.add(documentId);

            if (updates.length > COMPACT_AFTER) {
                compact(documentId);
            }
        }

        if (failed > 0) {
            displayError('A saved document could not be loaded. It is kept as it was saved.');
        }

        noticeOlderSaves();
    };

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
    if (!state.config.autoSave) {
        notSaving = 'Autosave is off.';
    } else if (!database) {
        notSaving = 'Documents cannot be saved in this browser.';
    } else {
        notSaving = undefined;
    }

    const savedIds = database ? await database.documentIds().catch(() => undefined) : [];

    if (!savedIds) {
        // Reading the database failed: show a new document, and write nothing over the saved ones.
        notSaving =
            'Saved documents could not be read. They are kept as saved; changes made here are not.';
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

    report();
    Object.keys(state.documents)
        .filter((documentId) => !isOpen(documentId))
        .forEach(create);

    let view: View = { cameras: {} };

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

    instance.addMutationListener(({ path, delimiter }) => {
        const [root, documentId, field] = path.split(delimiter);

        if (root === 'currentDocumentId' || (root === 'documents' && field === 'camera')) {
            clearTimeout(viewTimer);
            viewTimer = setTimeout(saveView, 500);
        }

        if (root !== 'documents' || !documentId || field !== undefined) {
            return;
        }

        touched.add(documentId);

        if (!reconcileQueued) {
            reconcileQueued = true;
            queueMicrotask(reconcile);
        }
    });

    sync = new TabSync(collaboration, effects.openChannel(), {
        created: (documentId, update) => openSaved(documentId, [update]),
        deleted: removeShared
    });
    unannounced.splice(0).forEach(([documentId, update]) => sync?.sendDocument(documentId, update));

    if (typeof window !== 'undefined') {
        window.addEventListener('pagehide', () => {
            collaboration.flush();
            saveView();
        });
        sync.listen(window, () => void catchUp());
    }

    void catchUp();
}
