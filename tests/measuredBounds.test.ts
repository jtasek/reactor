import { queueMeasuredBounds } from 'src/ui/components/Shape/measuring';
import { getShapeBounds, rectToBox } from 'src/app/utils';
import { createTestStore } from './support/store';

const box = (x: number) => ({
    topLeft: { x, y: 0 },
    topRight: { x: x + 10, y: 0 },
    bottomLeft: { x, y: 10 },
    bottomRight: { x: x + 10, y: 10 }
});

describe('storing measured boxes', () => {
    it('stores every box measured in one commit with one call, after the commit', async () => {
        const store = vi.fn();

        queueMeasuredBounds(store, { id: 'a', bounds: box(0) as never });
        queueMeasuredBounds(store, { id: 'b', bounds: box(20) as never });
        expect(store).not.toHaveBeenCalled();

        await Promise.resolve();
        expect(store).toHaveBeenCalledTimes(1);
        expect(store.mock.calls[0][0].map(({ id }: { id: string }) => id)).toEqual(['a', 'b']);
    });

    it('starts a new batch for the next commit', async () => {
        const store = vi.fn();

        queueMeasuredBounds(store, { id: 'a', bounds: box(0) as never });
        await Promise.resolve();
        queueMeasuredBounds(store, { id: 'b', bounds: box(20) as never });
        await Promise.resolve();

        expect(store).toHaveBeenCalledTimes(2);
        expect(store.mock.calls[1][0]).toHaveLength(1);
    });

    it('keeps later batches working when storing one fails', async () => {
        const failing = vi.fn(() => {
            throw new Error('no document');
        });
        const store = vi.fn();
        const failed = new Promise<void>((resolve) => {
            process.once('uncaughtException', () => resolve());
        });

        queueMeasuredBounds(failing, { id: 'a', bounds: box(0) as never });
        await failed;
        queueMeasuredBounds(store, { id: 'b', bounds: box(20) as never });
        await Promise.resolve();

        expect(store).toHaveBeenCalledTimes(1);
    });
});

describe('setShapesBounds', () => {
    const added = () => {
        const { store } = createTestStore();

        store.actions.addShape({
            type: 'rectangle',
            position: { x: 10, y: 20 },
            size: { width: 30, height: 40 }
        });
        const id = store.state.currentDocument.shapesIds[0];
        let mutations = 0;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (store as any).addMutationListener(() => mutations++);

        return { store, id, mutations: () => mutations };
    };

    it('stores nothing when the box matches what the shape says, so it is not drawn again', () => {
        const { store, id, mutations } = added();

        store.actions.setShapesBounds([
            { id, bounds: rectToBox({ x: 10, y: 20, width: 30, height: 40 }) }
        ]);

        expect(store.state.currentDocument.shapes[id].bounds).toBeUndefined();
        expect(mutations()).toBe(0);
    });

    it('stores a box that differs from what the shape says', () => {
        const { store, id } = added();
        const drawn = rectToBox({ x: 9, y: 19, width: 32, height: 42 });

        store.actions.setShapesBounds([{ id, bounds: drawn }]);

        expect(getShapeBounds(store.state.currentDocument.shapes[id])).toEqual(drawn);
    });

    it('replaces a stored box once the shape is drawn as its fields say', () => {
        const { store, id } = added();
        const fields = rectToBox({ x: 10, y: 20, width: 30, height: 40 });

        store.actions.setShapesBounds([
            { id, bounds: rectToBox({ x: 9, y: 19, width: 32, height: 42 }) }
        ]);
        store.actions.setShapesBounds([{ id, bounds: fields }]);

        expect(getShapeBounds(store.state.currentDocument.shapes[id])).toEqual(fields);
    });
});
