import { json } from 'overmind';
import type { Context } from '../index';
import type { Application, Camera } from '../types';
import { createDocument } from '../factories';
import {
    PERSISTENCE_KEY,
    SCHEMA_VERSION,
    migratePersistedState,
    readCamera,
    restoreDocuments
} from './documentStorage';
import { TabSync } from './tabSync';

/** Where this device keeps its view: the document it shows, and each document's camera. */
export const VIEW_KEY = `${PERSISTENCE_KEY}:view`;

/** Saved updates a document gathers before they are merged into one. */
const COMPACT_AFTER = 100;

type Instance = Pick<Context, 'state' | 'actions' | 'addMutationListener'>;

interface View {
    currentDocumentId?: string;
    cameras: Record<string, Camera>;
}

/** A saved view, without what is invalid in it. */
function readView(value: unknown): View {
    if (typeof value !== 'object' || value === null) {
        return { cameras: {} };
    }

    const currentDocumentId: unknown = Reflect.get(value, 'currentDocumentId');
    const cameras: unknown = Reflect.get(value, 'cameras');
    const valid = Object.entries(typeof cameras === 'object' && cameras !== null ? cameras : {})
        .map(([documentId, camera]): [string, Camera] | undefined => {
            try {
                return [documentId, readCamera(camera)];
            } catch {
                return undefined;
            }
        })
        .filter((entry) => entry !== undefined);

    return {
        currentDocumentId: typeof currentDocumentId === 'string' ? currentDocumentId : undefined,
        cameras: Object.fromEntries(valid)
    };
}

const viewOf = ({
    currentDocumentId,
    documents
}: Pick<Application, 'currentDocumentId' | 'documents'>) => ({
    currentDocumentId,
    cameras: Object.fromEntries(
        Object.values(documents).map(({ id, camera }) => [id, json(camera)])
    )
});

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
 */
export async function startDocumentSync(context: Context, instance: Instance): Promise<void> {
    const { state, effects } = context;
    const { collaboration } = effects;
    const { displayError, addDocument, removeDocument, applyRemoteChanges } = instance.actions;
    const database = await effects.openDocumentDatabase().catch(() => undefined);
    /** Documents in the database, so their changes are saved. */
    const saved = new Set<string>();
    /** Documents deleted here, which a late read of the database must not bring back. */
    const deletedHere = new Set<string>();
    const appended = new Map<string, number>();
    let saving = state.config.autoSave && database !== undefined;
    let failing = false;
    let viewTimer: ReturnType<typeof setTimeout> | undefined;
    let reconcileQueued = false;

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

    const compact = (documentId: string) =>
        database &&
        store(() =>
            database.compact(documentId, (updates) =>
                collaboration.merge(
                    collaboration.documentIds().includes(documentId)
                        ? [...updates, collaboration.state(documentId)]
                        : updates
                )
            )
        );

    const append = (documentId: string, update: Uint8Array) => {
        if (!database || !saving || !saved.has(documentId)) {
            return;
        }

        const count = (appended.get(documentId) ?? 0) + 1;

        void store(() => database.append(documentId, update));
        appended.set(documentId, count % COMPACT_AFTER);

        if (count === COMPACT_AFTER) {
            void compact(documentId);
        }
    };

    /** Opens a document another copy created and saved; one that fails stays out. */
    const openShared = (documentId: string, update: Uint8Array) => {
        addDocument({ id: documentId });

        try {
            collaboration.open(documentId, update);
            saved.add(documentId);
        } catch {
            collaboration.close(documentId);
            removeDocument(documentId);
        }
    };

    const removeShared = (documentId: string) => {
        collaboration.close(documentId);
        saved.delete(documentId);
        removeDocument(documentId);
    };

    const sync = new TabSync(collaboration, effects.openChannel(), {
        created: openShared,
        deleted: removeShared
    });

    /** Starts sharing and saving a document this copy made. */
    const create = (documentId: string) => {
        collaboration.open(documentId);

        if (database && saving) {
            saved.add(documentId);
            void store(() => database.create(documentId, collaboration.state(documentId)));
        }

        sync.sendDocument(documentId);
    };

    /** Shares and saves the documents this copy adds and deletes. */
    const reconcile = () => {
        reconcileQueued = false;

        const documentIds = Object.keys(instance.state.documents);
        const shared = collaboration.documentIds();

        documentIds.filter((documentId) => !shared.includes(documentId)).forEach(create);
        shared
            .filter((documentId) => !documentIds.includes(documentId))
            .forEach((documentId) => {
                collaboration.close(documentId);
                deletedHere.add(documentId);

                if (database && saved.delete(documentId)) {
                    void store(() => database.remove(documentId));
                }

                sync.sendDeleted(documentId);
            });
    };

    /** Picks up documents other copies created or deleted while this copy missed messages. */
    const refresh = async () => {
        if (!database) {
            return;
        }

        const known = new Set(saved);
        const savedIds = new Set(await database.documentIds());
        const isOpen = (documentId: string) => collaboration.documentIds().includes(documentId);

        [...known]
            .filter((documentId) => !savedIds.has(documentId) && isOpen(documentId))
            .forEach(removeShared);

        for (const documentId of savedIds) {
            if (isOpen(documentId) || deletedHere.has(documentId)) {
                continue;
            }

            const update = await database.load(documentId).then(
                (updates) => collaboration.merge(updates),
                () => undefined
            );

            if (update && !isOpen(documentId) && !deletedHere.has(documentId)) {
                openShared(documentId, update);
            }
        }
    };

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

    await collaboration.initialize({
        getDocument: (documentId) => instance.state.documents[documentId],
        applyRemoteChanges,
        addMutationListener: instance.addMutationListener,
        sendUpdate: (documentId, update) => {
            sync.send(documentId, update);
            append(documentId, update);
        }
    });

    if (state.config.autoSave && !database) {
        displayError('Documents cannot be saved in this browser. Changes made here are not kept.');
    }

    const savedIds = database ? await database.documentIds().catch(() => []) : [];

    if (!database || savedIds.length === 0) {
        // Nothing saved in the database yet: move the local storage save there, backed up first.
        try {
            if (saving) {
                effects.backupState(PERSISTENCE_KEY);
            }
        } catch {
            saving = false;
        }

        saving = loadLocalData(context) && saving;
        Object.keys(state.documents).forEach(create);
    } else {
        let failed = 0;

        state.documents = {};

        for (const documentId of savedIds) {
            try {
                const updates = await database.load(documentId);

                state.documents[documentId] = createDocument({ id: documentId });
                collaboration.open(documentId, collaboration.merge(updates));
                saved.add(documentId);

                if (updates.length > COMPACT_AFTER) {
                    void compact(documentId);
                }
            } catch {
                collaboration.close(documentId);
                delete state.documents[documentId];
                failed++;
            }
        }

        if (failed > 0) {
            displayError('A saved document could not be loaded. It is kept as it was saved.');
        }

        if (Object.keys(state.documents).length === 0) {
            const document = createDocument();

            state.documents[document.id] = document;
            create(document.id);
        }
    }

    let view: View = { cameras: {} };

    try {
        view = readView(effects.loadState(VIEW_KEY));
    } catch {
        // An unreadable view shows the first document, with its saved camera.
    }

    Object.entries(view.cameras)
        .filter(([documentId]) => state.documents[documentId])
        .forEach(([documentId, camera]) => {
            state.documents[documentId].camera = camera;
        });

    if (view.currentDocumentId && state.documents[view.currentDocumentId]) {
        state.currentDocumentId = view.currentDocumentId;
    } else if (!state.documents[state.currentDocumentId]) {
        state.currentDocumentId = Object.keys(state.documents)[0];
    }

    instance.addMutationListener(({ path, delimiter }) => {
        const [root, , field] = path.split(delimiter);

        if (root === 'currentDocumentId' || (root === 'documents' && field === 'camera')) {
            clearTimeout(viewTimer);
            viewTimer = setTimeout(saveView, 500);
        }

        if (root === 'documents' && field === undefined && !reconcileQueued) {
            reconcileQueued = true;
            queueMicrotask(reconcile);
        }
    });

    if (typeof window !== 'undefined') {
        window.addEventListener('pagehide', () => {
            collaboration.flush();
            saveView();
        });
        sync.listen(window, () => {
            void refresh()
                .catch(() => undefined)
                .then(() => sync.catchUp());
        });
    }

    sync.catchUp();
}
