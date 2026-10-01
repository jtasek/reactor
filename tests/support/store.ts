import { IDBFactory } from 'fake-indexeddb';
import { createOvermindMock } from 'overmind';
import { vi } from 'vitest';
import { config } from 'src/app';
import { createApplication, createDocument } from 'src/app/factories';
import { Collaboration } from 'src/app/services/collaboration';
import { createClipboard } from 'src/app/services/clipboard';
import { createAssets } from 'src/app/services/assets';
import { DocumentDatabase } from 'src/app/services/documentDatabase';
import type { Accounts } from 'src/app/services/accounts';
import type { Api, Transport } from 'src/app/services/api';
import type { Channel } from 'src/app/services/tabSync';

/** A server without accounts. */
const noAccounts: Accounts = {
    session: async () => undefined,
    signIn: async () => ({ ok: false, message: 'No accounts' }),
    signUp: async () => ({ ok: false, message: 'No accounts' }),
    sendSignInLink: async () => ({ ok: false, message: 'No accounts' }),
    signOut: async () => ({ ok: false, message: 'No accounts' })
};

const unreachable = () => Promise.reject(new Error('The server cannot be reached'));

/** A server that cannot be reached. */
const offline: Api = {
    workspaces: unreachable,
    documents: unreachable,
    createDocument: unreachable,
    deleteDocument: unreachable
};

/** A channel no other copy listens on. */
const quietChannel = (): Channel => ({ onmessage: null, postMessage: () => {}, close: () => {} });

/**
 * JSON-backed effects reproduce the storage boundary without browser globals. Each
 * store gets its own collaboration effect and IndexedDB, so copies of the editor
 * stay apart; stores given one `indexedDB` share it, as copies on one device do.
 */
export function createTestStore(
    seed: Record<string, string> = {},
    options: {
        autoSave?: boolean;
        collaboration?: Collaboration;
        indexedDB?: IDBFactory;
        openChannel?: (name?: string) => Channel;
        accounts?: Accounts;
        lastOwner?: string;
        api?: Api;
        serverTransport?: Transport;
        /** Local storage shared with other stores, as copies on one device share it. */
        storage?: Map<string, string>;
        /** The file chosen when the image tool asks for one; none by default. */
        pickImage?: () => Promise<Blob | null>;
    } = {}
) {
    const storage = options.storage ?? new Map(Object.entries(seed));
    const indexedDB = options.indexedDB ?? new IDBFactory();
    let copied = '';
    // The system clipboard, kept in memory.
    const systemClipboard = {
        readText: async () => copied,
        writeText: async (text: string) => {
            copied = text;
        }
    };
    const effects = {
        newId: vi.fn(() => `test-id-${nextId++}`),
        loadState: vi.fn((key: string): unknown => {
            const value = storage.get(key);

            return value === undefined ? undefined : JSON.parse(value);
        }),
        saveState: vi.fn((key: string, value: unknown) => {
            storage.set(key, JSON.stringify(value));
        }),
        backupState: vi.fn((key: string) => {
            const value = storage.get(key);

            if (value !== undefined) {
                storage.set(`${key}:backup`, value);
            }
        }),
        initializeRoutes: vi.fn<typeof config.effects.initializeRoutes>(),
        navigate: vi.fn<typeof config.effects.navigate>(),
        reload: vi.fn<typeof config.effects.reload>(),
        reloadPage: vi.fn<typeof config.effects.reloadPage>(),
        lastOwner: vi.fn(() => options.lastOwner),
        forgetOwner: vi.fn<typeof config.effects.forgetOwner>(),
        shareOwner: vi.fn<typeof config.effects.shareOwner>(() => true),
        collaboration: options.collaboration ?? new Collaboration(),
        openDocumentDatabase: (name?: string) => DocumentDatabase.open(indexedDB, name),
        openChannel: options.openChannel ?? quietChannel,
        accounts: options.accounts ?? noAccounts,
        api: options.api ?? offline,
        serverTransport: () => options.serverTransport ?? { url: 'ws://127.0.0.1:9/sync' },
        clipboard: createClipboard(systemClipboard),
        viewSize: () => ({ width: 1000, height: 800 }),
        // Every image measures 200 by 100, as nothing decodes images here.
        assets: createAssets({
            pick: options.pickImage ?? (async () => null),
            measure: async () => ({ width: 200, height: 100 })
        })
    };
    let nextId = 1;
    const document = createDocument({ id: 'test-document' });
    const app = createApplication({
        currentDocumentId: document.id,
        documents: { [document.id]: document },
        config: { autoSave: options.autoSave ?? false, debugMode: false, version: '1.0' }
    });
    const store = createOvermindMock(config, effects, (state) => {
        Object.assign(state, app);
    });

    effects.clipboard.connect(store.actions);
    effects.assets.use(Promise.resolve().then(() => DocumentDatabase.open(indexedDB)));
    effects.assets.connect(store.actions);

    // Initialization is opt-in: normal action tests never register routes or load
    // saved documents. Startup tests can explicitly call store.onInitialize().
    return { store, storage, effects, systemClipboard };
}
