import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startAutosave, disposeAutosave } from '../src/app/services/autosave';
import { createTestStore } from './support/store';

describe('autosave lifecycle', () => {
    const cleanup: (() => void)[] = [];

    beforeEach(() => vi.useFakeTimers());

    afterEach(() => {
        cleanup.splice(0).forEach((dispose) => dispose());
        vi.useRealTimers();
    });

    it('persists inactive-document edits, coalesces writes, and flushes on disposal', async () => {
        const { store, effects } = createTestStore();
        const errors = vi.fn();

        store.actions.addDocument({ id: 'other' });

        const controller = startAutosave(store, effects, errors);

        cleanup.push(() => controller.dispose());

        store.actions.updateDocument({ id: 'other', name: 'First edit' });
        store.actions.updateDocument({ id: 'other', name: 'Last edit' });

        await vi.advanceTimersByTimeAsync(500);

        expect(effects.saveState).toHaveBeenCalledTimes(1);
        expect(effects.loadState('reactor')).toMatchObject({
            documents: { other: { name: 'Last edit' } }
        });

        store.actions.updateDocument({ id: 'other', name: 'Final edit' });

        controller.dispose();

        expect(effects.saveState).toHaveBeenCalledTimes(2);

        store.actions.updateDocument({ id: 'other', name: 'After disposal' });

        await vi.advanceTimersByTimeAsync(500);
        expect(effects.saveState).toHaveBeenCalledTimes(2);
        expect(errors).not.toHaveBeenCalled();
    });

    it('reports storage failure and retries on the next change', async () => {
        const { store, effects } = createTestStore();
        const errors = vi.fn();

        const controller = startAutosave(store, effects, errors);

        cleanup.push(() => controller.dispose());

        effects.saveState.mockImplementationOnce(() => {
            throw new Error('Quota exceeded');
        });

        store.actions.updateDocument({ id: store.state.currentDocumentId, name: 'Unsaved' });

        await vi.advanceTimersByTimeAsync(500);

        expect(errors).toHaveBeenCalledOnce();

        store.actions.updateDocument({ id: store.state.currentDocumentId, name: 'Retry' });

        await vi.advanceTimersByTimeAsync(500);
        expect(effects.loadState('reactor')).toMatchObject({
            documents: { 'test-document': { name: 'Retry' } }
        });
    });

    it('ignores transient selection changes', async () => {
        const { store, effects } = createTestStore();

        store.actions.addShape({ type: 'rectangle', size: { width: 10, height: 20 } });

        const controller = startAutosave(store, effects, vi.fn());

        cleanup.push(() => controller.dispose());
        store.actions.unselectShapes();

        await vi.advanceTimersByTimeAsync(500);
        expect(effects.saveState).not.toHaveBeenCalled();
    });

    it.each(['{bad json', JSON.stringify({ version: 999, documents: {} })])(
        'preserves unreadable/unsupported storage: %s',
        async (original) => {
            const { store, effects, storage } = createTestStore(
                { reactor: original },
                { autoSave: true }
            );

            cleanup.push(() => disposeAutosave(store));

            await store.onInitialize();

            store.actions.addShape({ type: 'rectangle', size: { width: 10, height: 20 } });

            await vi.advanceTimersByTimeAsync(1000);
            expect(storage.get('reactor')).toBe(original);
            expect(effects.saveState).not.toHaveBeenCalled();
            expect(store.state.notifications[0].message).toContain('preserved');
        }
    );
});
