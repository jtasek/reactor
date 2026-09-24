import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestStore } from './support/store';
import { SCHEMA_VERSION, serializePersistedState } from 'src/app/services/documentStorage';
import { startAutosave, disposeAutosave } from 'src/app/services/autosave';

describe('autosave lifecycle', () => {
    const cleanup: (() => void)[] = [];

    beforeEach(() => vi.useFakeTimers());

    afterEach(() => {
        cleanup.splice(0).forEach((dispose) => dispose());

        vi.unstubAllGlobals();
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

        store.actions.addShape({
            type: 'rectangle',
            position: { x: 0, y: 0 },
            size: { width: 10, height: 20 }
        });

        const controller = startAutosave(store, effects, vi.fn());

        cleanup.push(() => controller.dispose());

        store.actions.unselectShapes();

        await vi.advanceTimersByTimeAsync(500);

        expect(effects.saveState).not.toHaveBeenCalled();
    });

    it('schedules no save for changes to fields that are never saved', () => {
        const { store, effects } = createTestStore();

        store.actions.addShape({
            type: 'rectangle',
            position: { x: 0, y: 0 },
            size: { width: 10, height: 20 }
        });

        const [shapeId] = store.state.currentDocument.shapesIds;
        const controller = startAutosave(store, effects, vi.fn());
        const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

        cleanup.push(
            () => controller.dispose(),
            () => setTimeoutSpy.mockRestore()
        );

        store.actions.activateShape(shapeId);
        store.actions.unselectShapes();
        store.actions.setShapeBounds({
            id: shapeId,
            bounds: {
                topLeft: { x: 1, y: 1 },
                bottomRight: { x: 11, y: 21 },
                width: 10,
                height: 20
            }
        });

        expect(setTimeoutSpy).not.toHaveBeenCalledWith(expect.any(Function), 500);
    });

    it('loads documents another tab saved, without saving them again', async () => {
        const window = new EventTarget();

        vi.stubGlobal('window', window);

        const { store, effects, storage } = createTestStore();
        const controller = startAutosave(store, effects, vi.fn());
        const otherTab = createTestStore().store;

        cleanup.push(controller.dispose);

        otherTab.actions.addDocument({ id: 'from-other-tab' });
        storage.set('reactor', JSON.stringify(serializePersistedState(otherTab.state)));
        window.dispatchEvent(
            Object.assign(new Event('storage'), {
                key: 'reactor',
                newValue: storage.get('reactor')
            })
        );

        expect(store.state.documentsIds).toContain('from-other-tab');
        expect(store.state.currentDocumentId).toBe('test-document');

        await vi.advanceTimersByTimeAsync(500);

        expect(effects.saveState).not.toHaveBeenCalled();
    });

    it('stops saving, and says so, when another tab saves data it cannot read', async () => {
        const window = new EventTarget();

        vi.stubGlobal('window', window);

        const { store, effects, storage } = createTestStore();
        const errors = vi.fn();
        const controller = startAutosave(store, effects, errors);
        const newer = JSON.stringify({ version: 99 });

        cleanup.push(controller.dispose);

        storage.set('reactor', newer);
        window.dispatchEvent(
            Object.assign(new Event('storage'), { key: 'reactor', newValue: newer })
        );
        store.actions.updateDocument({ id: store.state.currentDocumentId, name: 'Not saved' });

        await vi.advanceTimersByTimeAsync(500);
        controller.dispose();

        expect(errors).toHaveBeenCalledOnce();
        expect(effects.saveState).not.toHaveBeenCalled();
        expect(storage.get('reactor')).toBe(newer);
    });

    it('flushes on pagehide and removes its listeners on disposal', async () => {
        const window = new EventTarget();
        const removeListener = vi.spyOn(window, 'removeEventListener');

        vi.stubGlobal('window', window);

        const { store, effects } = createTestStore();
        const controller = startAutosave(store, effects, vi.fn());

        cleanup.push(controller.dispose);

        store.actions.updateDocument({ id: store.state.currentDocumentId, name: 'Leaving' });
        window.dispatchEvent(new Event('pagehide'));

        expect(effects.saveState).toHaveBeenCalledOnce();

        await vi.advanceTimersByTimeAsync(500);

        expect(effects.saveState).toHaveBeenCalledOnce();

        controller.dispose();
        controller.dispose();
        store.actions.updateDocument({ id: store.state.currentDocumentId, name: 'Disposed' });
        window.dispatchEvent(new Event('pagehide'));

        expect(effects.saveState).toHaveBeenCalledOnce();
        expect(removeListener.mock.calls.map(([type]) => type)).toEqual(['pagehide', 'storage']);
        expect(removeListener).toHaveBeenCalledWith('pagehide', controller.flush);
    });

    it('replaces an existing controller without leaving duplicate subscriptions', async () => {
        const { store, effects } = createTestStore();
        const first = startAutosave(store, effects, vi.fn());

        store.actions.updateDocument({ id: store.state.currentDocumentId, name: 'First' });

        const second = startAutosave(store, effects, vi.fn());

        cleanup.push(second.dispose);

        expect(effects.saveState).toHaveBeenCalledOnce();

        first.dispose();
        store.actions.updateDocument({ id: store.state.currentDocumentId, name: 'Second' });

        await vi.advanceTimersByTimeAsync(500);

        expect(effects.saveState).toHaveBeenCalledTimes(2);

        disposeAutosave(store);
        store.actions.updateDocument({ id: store.state.currentDocumentId, name: 'Stopped' });

        await vi.advanceTimersByTimeAsync(500);

        expect(effects.saveState).toHaveBeenCalledTimes(2);
    });

    it('backs up version 1 bytes before saving a migrated document', async () => {
        const first = createTestStore();
        const payload = serializePersistedState(first.store.state);
        const original = JSON.stringify({ ...payload, version: 1 });
        const { store, effects, storage } = createTestStore(
            { reactor: original },
            { autoSave: true }
        );

        cleanup.push(() => disposeAutosave(store));

        await store.onInitialize();

        expect(storage.get('reactor:backup')).toBe(original);
        expect(effects.saveState).not.toHaveBeenCalled();

        store.actions.updateDocument({ id: store.state.currentDocumentId, name: 'Migrated' });

        await vi.advanceTimersByTimeAsync(500);

        expect(effects.loadState('reactor')).toMatchObject({
            version: SCHEMA_VERSION,
            documents: { 'test-document': { name: 'Migrated' } }
        });
        expect(storage.get('reactor:backup')).toBe(original);
    });

    it('does not overwrite version 1 data when its backup fails', async () => {
        const payload = serializePersistedState(createTestStore().store.state);
        const original = JSON.stringify({ ...payload, version: 1 });
        const { store, effects, storage } = createTestStore(
            { reactor: original },
            { autoSave: true }
        );

        effects.backupState.mockImplementationOnce(() => {
            throw new Error('Quota exceeded');
        });

        cleanup.push(() => disposeAutosave(store));

        await store.onInitialize();

        store.actions.updateDocument({ id: store.state.currentDocumentId, name: 'New work' });

        await vi.advanceTimersByTimeAsync(500);

        expect(storage.get('reactor')).toBe(original);
        expect(effects.saveState).not.toHaveBeenCalled();
        expect(store.state.notifications[0].message).toContain('preserved');
    });

    it.each(['null', '{bad json', JSON.stringify({ version: 999, documents: {} })])(
        'preserves unreadable/unsupported storage: %s',
        async (original) => {
            const { store, effects, storage } = createTestStore(
                { reactor: original },
                { autoSave: true }
            );

            cleanup.push(() => disposeAutosave(store));

            await store.onInitialize();

            store.actions.addShape({
                type: 'rectangle',
                position: { x: 0, y: 0 },
                size: { width: 10, height: 20 }
            });

            await vi.advanceTimersByTimeAsync(1000);

            expect(storage.get('reactor')).toBe(original);
            expect(effects.saveState).not.toHaveBeenCalled();
            expect(store.state.notifications[0].message).toContain('preserved');
        }
    );
});
