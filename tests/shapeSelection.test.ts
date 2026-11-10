import type { Document } from 'src/app/types';
import { RUNTIME_FIELDS } from 'src/app/services/documentStorage';
import { createTestStore } from './support/store';

type Store = ReturnType<typeof createTestStore>['store'];

/** A store whose document holds `count` unselected rectangles. */
function storeWith(count: number) {
    const { store } = createTestStore();

    for (let index = 0; index < count; index++) {
        store.actions.addShape({
            type: 'rectangle',
            position: { x: index * 10, y: 0 },
            size: { width: 6, height: 6 },
            selected: false
        });
    }

    return store;
}

/** The list and the flags name the same shapes. */
function expectInStep(document: Document) {
    const flagged = Object.values(document.shapes)
        .filter((shape) => shape.selected)
        .map((shape) => shape.id)
        .sort();

    expect([...document.shapeSelection].sort()).toEqual(flagged);
}

/** The store paths reading `key` of the current document depends on. */
function trackedPaths(store: Store, key: keyof Document) {
    const tree = (
        store as unknown as {
            proxyStateTreeInstance: {
                getTrackStateTree: () => {
                    track: () => void;
                    state: { currentDocument: Document };
                    pathDependencies: Set<string>;
                };
            };
        }
    ).proxyStateTreeInstance.getTrackStateTree();

    tree.track();
    void tree.state.currentDocument[key];

    return tree.pathDependencies.size;
}

describe('the list of selected shapes', () => {
    it('stays in step with the flags as shapes are selected, added and deleted', () => {
        const store = storeWith(6);
        const document = () => store.state.currentDocument;
        const ids = document().shapesIds;

        store.actions.selectShape(ids[0]);
        store.actions.toggleShapeSelected(ids[2]);
        expectInStep(document());
        expect(document().selectedShapesIds).toEqual([ids[0], ids[2]]);

        store.actions.toggleShapeSelected(ids[0]);
        expect(document().selectedShapesIds).toEqual([ids[2]]);

        // New shapes come selected.
        store.actions.addShape({
            type: 'rectangle',
            position: { x: 0, y: 50 },
            size: { width: 6, height: 6 }
        });
        expectInStep(document());
        expect(document().selectedShapesIds).toHaveLength(2);

        store.actions.removeShapes([ids[2]]);
        expectInStep(document());
        expect(document().shapeSelection).not.toContain(ids[2]);

        store.actions.unselectShapes();
        expectInStep(document());
        expect(document().shapeSelection).toEqual([]);
    });

    it('answers the selection in the order the document holds it', () => {
        const store = storeWith(4);
        const ids = store.state.currentDocument.shapesIds;

        store.actions.selectShape(ids[3]);
        store.actions.selectShape(ids[1]);

        expect(store.state.currentDocument.selectedShapesIds).toEqual([ids[1], ids[3]]);
        expect(store.state.currentDocument.editableSelectedShapesIds).toEqual([ids[1], ids[3]]);
    });

    it('leaves hidden shapes out until they are shown', () => {
        const store = storeWith(2);
        const [id] = store.state.currentDocument.shapesIds;

        store.actions.selectShape(id);
        store.actions.hideSelection();

        expectInStep(store.state.currentDocument);
        expect(store.state.currentDocument.selectedShapesIds).toEqual([]);
    });

    it('unselects shapes being hidden in one write of the list', () => {
        const store = storeWith(30);
        const ids = store.state.currentDocument.shapesIds;

        ids.forEach((id) => store.actions.selectShape(id));
        let listWrites = 0;
        const stop = store.addMutationListener(({ path }) => {
            if (path.endsWith('.shapeSelection')) {
                listWrites++;
            }
        });

        store.actions.hideSelection();
        stop();

        expectInStep(store.state.currentDocument);
        expect(listWrites).toBe(1);
    });

    it('is not saved or shared', () => {
        const store = storeWith(1);

        store.actions.selectShape(store.state.currentDocument.shapesIds[0]);

        expect(store.state.currentDocument.shapeSelection).toHaveLength(1);
        // Runtime fields are left out of saved and shared documents.
        expect(RUNTIME_FIELDS.has('shapeSelection')).toBe(true);
    });

    it('lets what reads the selection depend on the selected shapes, not on every shape', () => {
        const counts = [20, 400].map((count) => {
            const store = storeWith(count);
            const ids = store.state.currentDocument.shapesIds;

            store.actions.selectShape(ids[1]);
            store.actions.selectShape(ids[5]);

            return (
                ['selectedShapesIds', 'editableSelectedShapesIds', 'selectedGroupsIds'] as const
            ).map((key) => trackedPaths(store, key));
        });

        expect(counts[1]).toEqual(counts[0]);
    });
});
