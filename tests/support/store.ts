import { createOvermindMock } from 'overmind';
import { vi } from 'vitest';
import { config } from 'src/app';
import { createApplication, createDocument } from 'src/app/factories';
import { Collaboration } from 'src/app/services/collaboration';

/**
 * JSON-backed effects reproduce the storage boundary without browser globals. Each
 * store gets its own collaboration effect, so copies of the editor stay apart.
 */
export function createTestStore(
    seed: Record<string, string> = {},
    options: { autoSave?: boolean; collaboration?: Collaboration } = {}
) {
    const storage = new Map(Object.entries(seed));
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
        collaboration: options.collaboration ?? new Collaboration()
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

    // Initialization is opt-in: normal action tests never register routes or
    // autosave reactions. Startup tests can explicitly call store.onInitialize().
    return { store, storage, effects };
}
