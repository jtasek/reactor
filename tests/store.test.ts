import { describe, expect, it } from 'vitest';
import { createTestStore } from './support/store';

describe('store harness', () => {
    it('runs real actions and derived indexes with isolated state', () => {
        const first = createTestStore();
        const second = createTestStore();

        first.store.actions.addShape({
            type: 'rectangle',
            position: { x: 10, y: 20 },
            size: { width: 30, height: 40 }
        });

        const document = first.store.state.currentDocument;

        expect(document.shapesIds).toHaveLength(1);
        expect(document.selectedShapesIds).toEqual(document.shapesIds);
        expect(second.store.state.currentDocument.shapesIds).toEqual([]);
        expect(first.effects.initializeRoutes).not.toHaveBeenCalled();
        expect(first.effects.loadState).not.toHaveBeenCalled();
    });

    it('stores snapshots rather than retaining references to caller data', () => {
        const { effects, storage } = createTestStore();
        const payload = { camera: { scale: 1 } };

        effects.saveState('example', payload);
        payload.camera.scale = 2;

        expect(effects.loadState('example')).toEqual({ camera: { scale: 1 } });
        expect(storage.get('example')).toBe('{"camera":{"scale":1}}');
    });

    it('runs startup explicitly with mocked storage and routing effects', async () => {
        const { store, effects } = createTestStore();

        await store.onInitialize();

        expect(effects.initializeRoutes).toHaveBeenCalledOnce();
        expect(effects.loadState).toHaveBeenCalledWith('reactor');
        expect(effects.saveState).not.toHaveBeenCalled();
        expect(store.state.currentDocument.id).toBe('test-document');
    });
});
