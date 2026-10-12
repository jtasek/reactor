import { createTestStore } from './support/store';

function storeWithComponent() {
    const { store } = createTestStore();

    store.actions.addShape({
        type: 'rectangle',
        position: { x: 10, y: 20 },
        size: { width: 30, height: 40 }
    });
    store.actions.addComponent({
        id: 'card',
        name: 'Card',
        shapesIds: [...store.state.currentDocument.shapesIds],
        sourceOnly: true
    });

    const document = () => store.state.currentDocument;
    const instances = () =>
        document()
            .shapesIds.map((id) => document().shapes[id])
            .filter((shape) => shape.type === 'instance');

    return { store, document, instances };
}

describe('instance names', () => {
    it('follow their component, with a number once the name is taken', () => {
        const { store, instances } = storeWithComponent();

        store.actions.insertComponentAt({ componentId: 'card', position: { x: 100, y: 0 } });
        store.actions.insertComponentAt({ componentId: 'card', position: { x: 200, y: 0 } });

        expect(instances().map((shape) => shape.name)).toEqual(['Card', 'Card 2']);
    });

    it('are given to clones and to pasted copies the same way', () => {
        const { store, instances } = storeWithComponent();

        store.actions.insertComponentAt({ componentId: 'card', position: { x: 100, y: 0 } });

        const copied = store.actions.copySelection()!;

        store.actions.cloneShapes([instances()[0].id]);
        store.actions.pasteShapes(copied);

        expect(instances().map((shape) => shape.name)).toEqual(['Card', 'Card 2', 'Card 3']);
    });
});
