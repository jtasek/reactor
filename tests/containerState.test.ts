import { containerStatesOf } from 'src/app/containerState';
import type { Document } from 'src/app/types';
import { isShapeLocked, isShapeVisible } from 'src/app/utils';
import { createTestStore } from './support/store';

/** Six rectangles: a group of two, a layer of two, a component of one, and one alone. */
function setup() {
    const { store } = createTestStore();

    for (let index = 0; index < 6; index++) {
        store.actions.addShape({
            type: 'rectangle',
            position: { x: index * 40, y: 0 },
            size: { width: 30, height: 30 }
        });
    }
    const ids = [...store.state.currentDocument.shapesIds];

    store.actions.addGroup({ id: 'group', shapesIds: [ids[0], ids[1]] });
    store.actions.addLayer({ id: 'layer', shapesIds: [ids[2], ids[3]] });
    store.actions.addLayer({ id: 'other', shapesIds: [ids[3]] });
    store.actions.addComponent({ id: 'component', shapesIds: [ids[4]] });

    return { store, ids };
}

/** The answers the kept states give, next to those of a plain snapshot without them. */
function answers(document: Document, ids: string[]) {
    const plain = {
        ...JSON.parse(JSON.stringify(document)),
        // Plain snapshots keep these derived fields' types, but not containerStates.
        sourceOnlyShapesIds: document.sourceOnlyShapesIds,
        frameStates: document.frameStates,
        editingComponentId: document.editingComponentId,
        containerStates: undefined
    } as Document;

    expect(containerStatesOf(document)).toBeDefined();
    expect(containerStatesOf(plain)).toBeUndefined();

    const read = (from: Document) =>
        ids.map((id) => [isShapeVisible(from, id), isShapeLocked(from, id)]);

    expect(read(document)).toEqual(read(plain));

    return read(document);
}

describe('shapes hidden or locked by their containers', () => {
    it('match asking each container, as containers are hidden, locked and shown alone', () => {
        const { store, ids } = setup();
        const document = () => store.state.currentDocument;

        expect(answers(document(), ids).every(([visible, locked]) => visible && !locked)).toBe(
            true
        );

        store.actions.toggleGroupVisible('group');
        store.actions.toggleLayerLocked('layer');
        expect(answers(document(), ids)).toEqual([
            [false, false],
            [false, false],
            [true, true],
            [true, true],
            [true, false],
            [true, false]
        ]);

        // Hidden, the layer still shows its shapes while it is the one shown alone.
        store.actions.toggleLayerVisible('layer');
        store.actions.showOnlyLayer('layer');
        answers(document(), ids);
        expect(isShapeVisible(document(), ids[2])).toBe(true);
        // On a layer, but not the one shown: hidden. On no layer: shown.
        expect(isShapeVisible(document(), ids[5])).toBe(true);

        store.actions.showOnlyLayer('other');
        answers(document(), ids);
        expect(isShapeVisible(document(), ids[2])).toBe(false);
    });

    it('follow a shape joining a group', () => {
        const { store, ids } = setup();
        const group = () => store.state.currentDocument.groups.group;

        store.actions.toggleGroupVisible('group');
        expect(isShapeVisible(store.state.currentDocument, ids[5])).toBe(true);

        store.actions.toggleGroupVisible('group');
        store.actions.addShapesToGroup({ shapeIds: [ids[5]], groupId: 'group' });
        expect(group().shapesIds).toContain(ids[5]);
        store.actions.toggleGroupVisible('group');
        expect(isShapeVisible(store.state.currentDocument, ids[5])).toBe(false);
        answers(store.state.currentDocument, ids);
    });
});
