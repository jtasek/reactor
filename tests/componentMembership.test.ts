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

describe('component members', () => {
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
