import { CloneCommand } from 'src/commands/clone';
import { byDrawingOrder, resolveDrawOrderTies } from 'src/app/drawOrder';
import { createDocument, createShape } from 'src/app/factories';
import { getShapeBounds } from 'src/app/utils';
import {
    PERSISTENCE_KEY,
    SCHEMA_VERSION,
    migratePersistedState,
    serializePersistedState
} from 'src/app/services/documentStorage';
import { createTestStore } from './support/store';

const rectangle = {
    type: 'rectangle' as const,
    position: { x: 0, y: 0 },
    size: { width: 10, height: 10 }
};

/**
 * A save whose shapes `s0`, `s1`, ... have these orders, each one wider than the one
 * before; `undefined` leaves one out.
 */
const saved = (orders: (string | undefined)[], version = SCHEMA_VERSION) => {
    const document = createDocument({ id: 'test-document' });

    orders.forEach((_, index) => {
        const id = `s${index}`;

        document.shapes[id] = {
            ...createShape({
                ...rectangle,
                size: { width: 10 + index, height: 10 },
                order: 'a0',
                name: id
            }),
            id
        };
    });

    const payload = JSON.parse(
        JSON.stringify(
            serializePersistedState({
                currentDocumentId: document.id,
                documents: { [document.id]: document }
            })
        )
    );

    orders.forEach((order, index) => {
        payload.documents[document.id].shapes[`s${index}`].order = order;
    });

    return JSON.stringify({ ...payload, version });
};

const loadedOrders = (json: string) =>
    Object.values(migratePersistedState(JSON.parse(json))!.documents['test-document'].shapes).map(
        ({ order }) => order
    );

/** A store that loaded `json` at startup. */
const loaded = async (json: string) => {
    const { store } = createTestStore({ [PERSISTENCE_KEY]: json });

    await store.onInitialize();

    return store;
};

describe('draw order', () => {
    it('draws shapes by their order', async () => {
        const store = await loaded(saved(['a2', 'a0', 'a1']));

        expect(store.state.currentDocument.shapesIds).toEqual(['s1', 's2', 's0']);
    });

    it('breaks ties by id', () => {
        const shapes = [
            { id: 'b', order: 'a1' },
            { id: 'a', order: 'a1' },
            { id: 'c', order: 'a0', name: 'shape' }
        ];

        expect(shapes.sort(byDrawingOrder).map(({ id }) => id)).toEqual(['c', 'a', 'b']);
    });

    it('unties orders by id, whatever order the items come in', () => {
        const items = [
            { id: 'c', order: 'a1' },
            { id: 'a', order: 'a1' },
            { id: 'b', order: 'a1' },
            { id: 'd', order: 'a2' }
        ];

        resolveDrawOrderTies(items);

        expect(items.find(({ id }) => id === 'a')?.order).toBe('a1');
        expect([...items].sort(byDrawingOrder).map(({ id }) => id)).toEqual(['a', 'b', 'c', 'd']);
        expect(new Set(items.map(({ order }) => order)).size).toBe(4);
    });

    it('gives tied saved orders new ones that keep the stacking', () => {
        const orders = loadedOrders(saved(['a1', 'a1', 'a1', 'a2']));

        expect(orders[0]).toBe('a1');
        expect(orders[3]).toBe('a2');
        expect(orders).toEqual([...new Set(orders)].sort());
    });

    it('puts new shapes and clones above every other shape', async () => {
        const store = await loaded(saved(['a5', 'a0']));
        const addedBy = (act: () => void) => {
            const before = new Set(store.state.currentDocument.shapesIds);

            act();

            return store.state.currentDocument.shapesIds.find((id) => !before.has(id))!;
        };

        const added = addedBy(() => store.actions.addShape(rectangle));
        const clone = addedBy(() => store.actions.cloneShapes(['s1']));

        expect(store.state.currentDocument.shapesIds).toEqual(['s1', 's0', added, clone]);
    });

    it('clones a selection above every other shape, stacked like the originals', async () => {
        const store = await loaded(saved(['a2', 'a1']));

        store.actions.selectShape('s0');
        store.actions.selectShape('s1');
        store.actions.runCommand(CloneCommand);

        const { shapes, shapesIds } = store.state.currentDocument;

        expect(shapesIds.map((id) => shapes[id].order)).toEqual(['a1', 'a2', 'a3', 'a4']);
        const width = (id: string) => getShapeBounds(shapes[id]).width;

        expect(shapesIds.slice(2).map(width)).toEqual([width('s1'), width('s0')]);
    });

    it('brings shapes to the front and sends them to the back, keeping their order', async () => {
        const store = await loaded(saved(['a0', 'a1', 'a2', 'a3']));
        const { currentDocument } = store.state;

        store.actions.lockShape('s2');
        store.actions.bringShapesToFront(['s1', 's0', 's2']);

        expect(currentDocument.shapesIds).toEqual(['s2', 's3', 's0', 's1']);

        store.actions.sendShapesToBack(['s1', 's3']);

        expect(currentDocument.shapesIds).toEqual(['s3', 's1', 's2', 's0']);
        expect(currentDocument.shapesIds).toEqual(
            Object.values(currentDocument.shapes)
                .sort(byDrawingOrder)
                .map(({ id }) => id)
        );
    });

    it('keeps shapesIds in draw order as shapes are added, cloned and removed', async () => {
        const store = await loaded(saved(['a2', undefined, 'a0', 'a1']));
        const { currentDocument } = store.state;

        store.actions.addShape(rectangle);
        store.actions.cloneShapes(['s0', 's2']);
        store.actions.removeShape('s3');

        expect(currentDocument.shapesIds).toHaveLength(6);
        expect(currentDocument.shapesIds).toEqual(
            Object.values(currentDocument.shapes)
                .sort(byDrawingOrder)
                .map(({ id }) => id)
        );
    });

    it('places shapes saved without a valid order above the others, in saved order', () => {
        const invalid = ['zz', 'a€', 'A00000000000000000000000001', `a0${'z'.repeat(1000)}1`];

        expect(loadedOrders(saved(['a5', 'a1', undefined]))).toEqual(['a5', 'a1', 'a6']);
        expect(loadedOrders(saved(['a5', ...invalid, 'a1']))).toEqual([
            'a5',
            'a6',
            'a7',
            'a8',
            'a9',
            'a1'
        ]);
    });

    it('orders shapes saved before version 4 as they were saved, after a backup', async () => {
        const original = saved([undefined, undefined, undefined], 3);
        const { store, storage } = createTestStore({ [PERSISTENCE_KEY]: original });

        await store.onInitialize();

        const { shapes, shapesIds } = store.state.currentDocument;

        expect(storage.get(`${PERSISTENCE_KEY}:backup`)).toBe(original);
        expect(shapesIds).toEqual(['s0', 's1', 's2']);
        expect(shapesIds.map((id) => shapes[id].order)).toEqual(['a0', 'a1', 'a2']);
        expect(store.state.notifications.filter(({ type }) => type === 'error')).toEqual([]);
    });

    it('backs up a current save whose orders had to be repaired', async () => {
        const original = saved(['a1', 'zz']);
        const { store, storage } = createTestStore({ [PERSISTENCE_KEY]: original });

        await store.onInitialize();

        expect(storage.get(`${PERSISTENCE_KEY}:backup`)).toBe(original);
        expect(store.state.currentDocument.shapes.s1.order).toBe('a2');
    });
});
