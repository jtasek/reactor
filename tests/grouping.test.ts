import { registerCommand } from 'src/app/actions/startup';
import type { ShapeInput } from 'src/app/types';
import * as commands from 'src/commands';
import { createTestStore } from './support/store';

// Commands are registered by application startup, which the test store skips.
Object.values(commands).forEach(registerCommand);

/** Where each shape is placed; every shape here is a square. */
const positions = (store: ReturnType<typeof createTestStore>['store'], ids: string[]) =>
    ids.map((id) => {
        const shape = store.state.currentDocument.shapes[id];

        return shape.type === 'rectangle' ? shape.position : null;
    });

const square = (x: number, y = 0): ShapeInput => ({
    type: 'rectangle',
    position: { x, y },
    size: { width: 10, height: 10 }
});

/** A store with a 10 by 10 square at each x, all selected. */
function storeWith(...xs: number[]) {
    const { store } = createTestStore();

    xs.forEach((x) => store.actions.addShape({ ...square(x), selected: true }));

    const document = () => store.state.currentDocument;
    const ids = [...document().shapesIds];
    const selected = () => document().shapesIds.filter((id) => document().shapes[id].selected);
    const groups = () => Object.values(document().groups).map((group) => [...group.shapesIds]);
    const layers = () => Object.values(document().layers).map((layer) => [...layer.shapesIds]);
    const select = (...chosen: string[]) => {
        store.actions.unselectShapes();
        chosen.forEach((id) => store.actions.selectShape(id));
    };
    const run = (command: string) => store.actions.submitCommandLine(command);

    return { store, document, ids, selected, groups, layers, select, run };
}

describe('Group', () => {
    it('groups the selected shapes in drawing order, and keeps them selected', () => {
        const { ids, groups, selected, run, document } = storeWith(0, 20, 40);

        expect(run('group')).toBeUndefined();

        expect(groups()).toEqual([ids]);
        expect(selected()).toEqual(ids);
        expect(document().selectedGroupsIds).toHaveLength(1);
    });

    it('needs two shapes it can edit', () => {
        const { store, ids, groups, run } = storeWith(0, 20);

        store.actions.lockShape(ids[1]);

        expect(run('group')).toBe('Group is not available right now');
        expect(groups()).toEqual([]);
    });

    it('moves shapes out of their groups, removing a group left with one shape', () => {
        const { ids, groups, select, run } = storeWith(0, 20, 40);

        select(ids[0], ids[1]);
        run('group');
        select(ids[1], ids[2]);
        run('group');

        expect(groups()).toEqual([[ids[1], ids[2]]]);
    });

    it('makes a group one selection: pressing or boxing a member selects all of it', () => {
        const { store, ids, selected, select, run } = storeWith(0, 20, 40);

        select(ids[0], ids[1]);
        run('group');
        store.actions.unselectShapes();

        store.actions.events.setCurrentPosition({ x: 25, y: 5 });
        store.actions.selectShapeAtPointer();
        expect(selected()).toEqual([ids[0], ids[1]]);

        store.actions.events.setStartPosition({ x: 2, y: 2 });
        store.actions.events.setCurrentPosition({ x: 4, y: 4 });
        store.actions.selectShapes();
        expect(selected()).toEqual([ids[0], ids[1]]);
    });

    it('moves a pressed group as one', () => {
        const { store, ids, select, run } = storeWith(0, 20, 40);

        select(ids[0], ids[1]);
        run('group');
        store.actions.unselectShapes();
        store.actions.events.beginGesture({ pointerId: 1, position: { x: 5, y: 5 } });
        store.actions.events.endGesture({ pointerId: 1, position: { x: 5, y: 15 } });

        expect(positions(store, ids)).toEqual([
            { x: 0, y: 10 },
            { x: 20, y: 10 },
            { x: 40, y: 0 }
        ]);
    });

    it('selects and unselects a group from its panel item', () => {
        const { store, ids, selected, select, run, document } = storeWith(0, 20, 40);

        select(ids[0], ids[1]);
        run('group');
        store.actions.unselectShapes();

        const [groupId] = Object.keys(document().groups);

        store.actions.toggleGroupSelected(groupId);
        expect(selected()).toEqual([ids[0], ids[1]]);

        store.actions.toggleGroupSelected(groupId);
        expect(selected()).toEqual([]);
    });
});

describe('Ungroup', () => {
    it('removes the groups of the selected shapes, which stay selected', () => {
        const { ids, groups, selected, run } = storeWith(0, 20);

        run('group');

        expect(run('ungroup')).toBeUndefined();
        expect(groups()).toEqual([]);
        expect(selected()).toEqual(ids);
    });

    it('is unavailable without a grouped shape selected, and leaves locked groups', () => {
        const { store, groups, ids, run, document } = storeWith(0, 20);

        expect(run('ungroup')).toBe('Ungroup is not available right now');

        run('group');
        store.actions.lockGroup(Object.keys(document().groups)[0]);

        expect(run('ungroup')).toBe('Ungroup is not available right now');
        expect(groups()).toEqual([ids]);
    });
});

describe('Layer', () => {
    it('moves the selected shapes into a new layer, removing layers left empty', () => {
        const { ids, layers, select, run } = storeWith(0, 20, 40);

        select(ids[0], ids[1]);
        expect(run('layer')).toBeUndefined();
        select(ids[1], ids[0]);
        run('layer');
        select(ids[2]);
        run('layer');

        expect(layers()).toEqual([[ids[0], ids[1]], [ids[2]]]);
    });

    it('needs a shape it can edit', () => {
        const { store, ids, layers, run } = storeWith(0);

        store.actions.lockShape(ids[0]);

        expect(run('layer')).toBe('Layer is not available right now');
        expect(layers()).toEqual([]);
    });
});

describe('Unlayer', () => {
    it('takes the selected shapes off their layers, removing layers left empty', () => {
        const { ids, layers, select, run } = storeWith(0, 20, 40);

        run('layer');
        select(ids[0]);
        expect(run('unlayer')).toBeUndefined();
        expect(layers()).toEqual([[ids[1], ids[2]]]);

        select(ids[1], ids[2]);
        run('unlayer');
        expect(layers()).toEqual([]);
    });

    it('is unavailable without a shape on an unlocked layer selected', () => {
        const { store, ids, layers, run, document } = storeWith(0);

        expect(run('unlayer')).toBe('Unlayer is not available right now');

        run('layer');
        store.actions.lockLayer(Object.keys(document().layers)[0]);

        expect(run('unlayer')).toBe('Unlayer is not available right now');
        expect(layers()).toEqual([ids]);
    });
});

describe('Clone', () => {
    it('selects the clones, so cloning again steps on', () => {
        const { store, ids, document, selected, run } = storeWith(0);

        run('clone');
        run('clone');

        expect(positions(store, document().shapesIds)).toEqual([
            { x: 0, y: 0 },
            { x: 10, y: 10 },
            { x: 20, y: 20 }
        ]);
        expect(selected()).toEqual([document().shapesIds[2]]);
        expect(selected()).not.toContain(ids[0]);
    });

    it('puts clones on their originals’ layers, and a cloned group in a group of its own', () => {
        const { ids, document, groups, layers, select, run } = storeWith(0, 20, 40);

        run('layer');
        select(ids[0], ids[1]);
        run('group');
        run('clone');

        const clones = document().shapesIds.slice(3);

        expect(layers()).toEqual([[...ids, ...clones]]);
        expect(groups()).toEqual([
            [ids[0], ids[1]],
            [clones[0], clones[1]]
        ]);
    });
});

it('copies a group with a hidden shape as a group of its own', () => {
    const { store, ids, document, groups, run } = storeWith(0, 20, 40);

    run('group');
    store.actions.hideShape(ids[2]);
    run('clone');

    const clones = document().shapesIds.slice(3);

    expect(groups()).toEqual([ids, clones]);
});

describe('Delete', () => {
    it('is unavailable when every selected shape is locked', () => {
        const { store, ids, run } = storeWith(0);

        store.actions.lockShape(ids[0]);

        expect(run('delete')).toBe('Delete is not available right now');
    });
});

describe('Zoom reset', () => {
    it('is unavailable at the default zoom', () => {
        const { run } = storeWith();

        expect(run('zoom reset')).toBe('Zoom reset is not available right now');

        run('zoom in');
        expect(run('zoom reset')).toBeUndefined();
    });
});

describe('the Layer and Unlayer shortcuts', () => {
    const press = (shiftKey: boolean) => ({
        // With Option held, a Mac reports the character the keys type, not the letter.
        key: shiftKey ? 'Ò' : '¬',
        code: 'KeyL',
        altKey: true,
        ctrlKey: false,
        metaKey: true,
        shiftKey
    });

    it('are Ctrl/Cmd+Alt+L and Ctrl/Cmd+Alt+Shift+L, whatever the keys type', () => {
        const { store, ids, layers } = storeWith(0);

        expect(store.actions.events.pressShortcut(press(false))).toBe(true);
        expect(layers()).toEqual([ids]);

        expect(store.actions.events.pressShortcut(press(true))).toBe(true);
        expect(layers()).toEqual([]);
    });
});
