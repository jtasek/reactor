import { migratePersistedState, serializePersistedState } from 'src/app/services/documentStorage';
import { createTestStore } from './support/store';

const rectangle = (order?: string) => ({
    type: 'rectangle' as const,
    position: { x: 0, y: 0 },
    size: { width: 10, height: 10 },
    ...(order === undefined ? {} : { order })
});

const savedWithOrders = (replace: (order: string, index: number) => string | undefined) => {
    const { store } = createTestStore();
    let index = 0;

    store.actions.addShape(rectangle());
    store.actions.addShape(rectangle());
    store.actions.addShape(rectangle());

    const saved = serializePersistedState(store.state);
    const replaced: unknown = JSON.parse(
        JSON.stringify(saved, (key, value) => (key === 'order' ? replace(value, index++) : value))
    );

    return { saved, replaced, documentId: store.state.currentDocumentId };
};

const loadedOrders = (payload: unknown, documentId: string) =>
    Object.values(migratePersistedState(payload)!.documents[documentId].shapes).map(
        ({ order }) => order
    );

describe('draw order', () => {
    it('draws shapes by their order, then by id', () => {
        const { store } = createTestStore();

        store.actions.addShape(rectangle('a2'));
        store.actions.addShape(rectangle('a0'));
        store.actions.addShape(rectangle('a1'));
        store.actions.addShape(rectangle('a1'));

        const { shapes, shapesIds } = store.state.currentDocument;
        const tied = shapesIds.filter((id) => shapes[id].order === 'a1');

        expect(shapesIds.map((id) => shapes[id].order)).toEqual(['a0', 'a1', 'a1', 'a2']);
        expect(tied).toEqual([...tied].sort());
    });

    it('puts new shapes and clones above every other shape', () => {
        const { store } = createTestStore();
        const addedBy = (act: () => void) => {
            const before = new Set(store.state.currentDocument.shapesIds);

            act();

            return store.state.currentDocument.shapesIds.find((id) => !before.has(id))!;
        };

        store.actions.addShape(rectangle('a5'));
        store.actions.addShape(rectangle('a0'));

        const added = addedBy(() => store.actions.addShape(rectangle()));
        const clone = addedBy(() => store.actions.cloneShape(added));
        const invalid = addedBy(() => store.actions.addShape(rectangle('zz')));
        const outsideAlphabet = addedBy(() => store.actions.addShape(rectangle('a€')));
        const unset = addedBy(() => store.actions.addShape({ ...rectangle(), order: undefined }));
        const { shapes, shapesIds } = store.state.currentDocument;

        expect(shapesIds.slice(-5)).toEqual([added, clone, invalid, outsideAlphabet, unset]);
        expect(shapes[added].order > 'a5').toBe(true);
    });

    it('ignores an invalid order in a shape update', () => {
        const { store } = createTestStore();

        store.actions.addShape(rectangle());

        const [id] = store.state.currentDocument.shapesIds;
        const { order } = store.state.currentDocument.shapes[id];

        store.actions.updateShape({ id, order: 'zz', name: 'Renamed' });

        expect(store.state.currentDocument.shapes[id]).toMatchObject({ order, name: 'Renamed' });
    });

    it('keeps the saved order of shapes saved before draw order existed', () => {
        const { saved, replaced, documentId } = savedWithOrders(() => undefined);
        const shapes = migratePersistedState(replaced)!.documents[documentId].shapes;
        const orders = Object.values(shapes).map(({ order }) => order);

        expect(Object.keys(shapes)).toEqual(Object.keys(saved.documents[documentId].shapes));
        expect(orders).toEqual([...orders].sort());
        expect(new Set(orders).size).toBe(3);
    });

    it('places shapes saved without a valid order above the ordered ones', () => {
        const mixed = savedWithOrders((order, index) => (index === 1 ? 'a1' : undefined));
        const invalid = savedWithOrders((order, index) => (index === 1 ? 'a1' : 'zz'));

        expect(loadedOrders(mixed.replaced, mixed.documentId)).toEqual(['a2', 'a1', 'a3']);
        expect(loadedOrders(invalid.replaced, invalid.documentId)).toEqual(['a2', 'a1', 'a3']);
    });

    it('keeps saved orders through a save and reload', () => {
        const { saved } = savedWithOrders((order) => order);

        expect(migratePersistedState(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    });
});
