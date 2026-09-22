import { createOvermindMock } from 'overmind';
import { vi } from 'vitest';
import { config } from '../../src/app';
import { createApplication, createDocument } from '../../src/app/factories';

/** JSON-backed effects reproduce the storage boundary without browser globals. */
export function createTestStore(seed: Record<string, string> = {}) {
    const storage = new Map(Object.entries(seed));
    const effects = {
        newId: vi.fn(() => `test-id-${nextId++}`),
        loadState: vi.fn((key: string): unknown => {
            const value = storage.get(key);
            return value === undefined ? null : JSON.parse(value);
        }),
        saveState: vi.fn((key: string, value: unknown) => {
            storage.set(key, JSON.stringify(value));
        }),
        initializeRoutes: vi.fn<typeof config.effects.initializeRoutes>(),
        navigate: vi.fn<typeof config.effects.navigate>()
    };
    let nextId = 1;
    const document = createDocument({ id: 'test-document' });
    const app = createApplication({
        currentDocumentId: document.id,
        documents: { [document.id]: document },
        config: { autoSave: false, debugMode: false, version: '1.0' }
    });
    const store = createOvermindMock(config, effects, (state) => {
        Object.assign(state, app);
    });

    // Initialization is opt-in: normal action tests never register routes or
    // autosave reactions. Startup tests can explicitly call store.onInitialize().
    return { store, storage, effects };
}
