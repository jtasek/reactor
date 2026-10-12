import { libraryUpdateAvailable } from 'src/app/computed/componentPanels';
import { createTestStore } from './support/store';

function setup() {
    const { store } = createTestStore();

    store.actions.addShape({
        type: 'rectangle',
        position: { x: 10, y: 20 },
        size: { width: 30, height: 40 }
    });
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 200, y: 20 },
        size: { width: 30, height: 40 }
    });

    const [sourceId, otherId] = store.state.currentDocument.shapesIds;

    store.actions.addComponent({ id: 'source', shapesIds: [sourceId] });

    return { store, sourceId, otherId };
}

describe('component sources', () => {
    it('are worked out once and kept while their content does not change', () => {
        const { store, sourceId, otherId } = setup();
        const sources = () => store.state.currentDocument.componentSources;
        const first = sources().source;

        expect(first?.shapes.map((shape) => shape.id)).toEqual([sourceId]);

        // A second component works the sources out again; this one did not change.
        store.actions.addComponent({ id: 'other', shapesIds: [otherId] });
        expect(sources().other).toBeDefined();
        expect(sources().source).toBe(first);

        store.actions.updateShape({ id: sourceId, position: { x: 50, y: 20 } });
        expect(sources().source).not.toBe(first);
        expect(sources().source?.box.topLeft.x).toBe(50);
    });

    it('list the shapes of the document’s own components', () => {
        const { store, sourceId, otherId } = setup();
        const members = store.state.currentDocument.componentMembersIds;

        expect(members.has(sourceId)).toBe(true);
        expect(members.has(otherId)).toBe(false);
    });
});

describe('an imported component', () => {
    it('offers an update only once its library holds a different version', () => {
        const { store, sourceId } = setup();
        const origin = store.state.currentDocumentId;

        store.actions.addDocument({ id: 'copy' });
        store.actions.openDocument('copy');
        store.actions.importLibraryComponent({ documentId: origin, componentId: 'source' });
        expect(libraryUpdateAvailable(store.state, 'source')).toBe(false);

        store.actions.openDocument(origin);
        store.actions.updateShape({ id: sourceId, position: { x: 90, y: 20 } });
        store.actions.openDocument('copy');
        expect(libraryUpdateAvailable(store.state, 'source')).toBe(true);
    });
});
