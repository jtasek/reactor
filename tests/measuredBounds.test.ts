import { queueMeasuredBounds } from 'src/ui/components/Shape/measuring';

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
