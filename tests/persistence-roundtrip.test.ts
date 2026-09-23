import { describe, expect, it } from 'vitest';
import { serializePersistedState } from '../src/app/services/documentStorage';
import { createTestStore } from './support/store';

describe('real persisted documents', () => {
    it('retains live derived indexes and dates after JSON restore', async () => {
        const first = createTestStore();

        first.store.actions.addShape({ type: 'rectangle', size: { width: 20, height: 30 } });

        const saved = JSON.stringify(serializePersistedState(first.store.state));
        const { store } = createTestStore({ reactor: saved });

        await store.onInitialize();

        store.actions.addShape({
            type: 'rectangle',
            position: { x: 5, y: 6 },
            size: { width: 10, height: 20 }
        });

        expect(store.state.currentDocument.shapesIds).toHaveLength(2);
        expect(store.state.currentDocument.created).toBeInstanceOf(Date);
    });
});
