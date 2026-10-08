import { registerCommand } from 'src/app/actions/startup';
import { filterOutline, outline } from 'src/app/membership';
import { serializePersistedState } from 'src/app/services/documentStorage';
import type { ShapeInput } from 'src/app/types';
import { isShapeVisible } from 'src/app/utils';
import * as commands from 'src/commands';
import { createCopies, deliver, edit, shownDocument } from './support/collaboration';
import { createTestStore } from './support/store';

// Commands are registered by application startup, which the test store skips.
Object.values(commands).forEach(registerCommand);

const square = (x: number): ShapeInput => ({
    type: 'rectangle',
    position: { x, y: 0 },
    size: { width: 10, height: 10 }
});

/** A store with a 10 by 10 square at each x, none selected. */
function storeWith(...xs: number[]) {
    const { store } = createTestStore();

    xs.forEach((x) => store.actions.addShape({ ...square(x), selected: false }));

    const document = () => store.state.currentDocument;
    const ids = [...document().shapesIds];
    const select = (...chosen: string[]) => {
        store.actions.unselectShapes();
        chosen.forEach((id) => store.actions.selectShape(id));
    };
    const run = (command: string) => store.actions.submitCommandLine(command);
    /** Each layer's shapes by layer name, and the shapes on no layer, when any, under `none`. */
    const layers = () =>
        Object.fromEntries(
            outline(document())
                .map((entry) => [
                    entry.layerId ? document().layers[entry.layerId].name : 'none',
                    [...entry.groups.flatMap((group) => group.shapesIds), ...entry.shapesIds]
                ])
                .filter(([, shapesIds]) => shapesIds.length > 0)
        );
    const layer = (name: string, ...shapesIds: string[]) =>
        store.actions.addLayer({ id: name, name, shapesIds });

    return { store, document, ids, select, run, layers, layer };
}

describe('a group is on one layer', () => {
    it('Group puts its shapes on the layer of the topmost one', () => {
        const { ids, select, run, layers, layer } = storeWith(0, 20, 40);

        layer('walls', ids[0]);
        layer('pipes', ids[2]);
        select(...ids);
        run('group');

        expect(layers()).toEqual({ pipes: ids });
    });

    it('Layer moves a selected group whole, hidden shapes too', () => {
        const { store, ids, select, run, document, layer } = storeWith(0, 20, 40);

        layer('walls', ...ids);
        select(ids[0], ids[1]);
        run('group');
        store.actions.hideShape(ids[1]);
        run('layer');

        const created = Object.values(document().layers).find(({ id }) => id !== 'walls')!;

        expect(created.shapesIds).toEqual([ids[0], ids[1]]);
        expect(document().layers.walls.shapesIds).toEqual([ids[2]]);
        expect(Object.values(document().groups)[0].shapesIds).toEqual([ids[0], ids[1]]);
    });

    it('moving one shape of a group to another layer takes it out of the group', () => {
        const { store, ids, select, run, document, layers, layer } = storeWith(0, 20, 40);

        layer('walls', ...ids);
        layer('pipes');
        select(...ids);
        run('group');
        store.actions.moveShapesToLayer({ shapeIds: [ids[0]], layerId: 'pipes' });

        expect(layers()).toEqual({ walls: [ids[1], ids[2]], pipes: [ids[0]] });
        expect(Object.values(document().groups)[0].shapesIds).toEqual([ids[1], ids[2]]);
    });

    it('a shape added to a group joins its layer and leaves its old group', () => {
        const { store, ids, select, run, document, layers, layer } = storeWith(0, 20, 40, 60);

        layer('walls', ids[0], ids[1]);
        select(ids[0], ids[1]);
        run('group');
        select(ids[2], ids[3]);
        run('group');

        const [walls, loose] = Object.keys(document().groups);

        store.actions.addShapesToGroup({ shapeIds: [ids[2]], groupId: walls });

        expect(document().groups[walls].shapesIds).toEqual([ids[0], ids[1], ids[2]]);
        expect(document().groups[loose]).toBeUndefined();
        expect(layers()).toEqual({ walls: [ids[0], ids[1], ids[2]], none: [ids[3]] });
    });

    it('lists layers, their groups and shapes as a tree, with shapes on no layer last', () => {
        const { ids, select, run, document, layer } = storeWith(0, 20, 40, 60);

        layer('walls', ids[0], ids[1], ids[2]);
        select(ids[0], ids[1]);
        run('group');

        const [groupId] = Object.keys(document().groups);

        expect(outline(document())).toEqual([
            {
                layerId: 'walls',
                groups: [{ groupId, shapesIds: [ids[0], ids[1]] }],
                shapesIds: [ids[2]]
            },
            { layerId: null, groups: [], shapesIds: [ids[3]] }
        ]);
    });
});

it('keeps the shapes on no layer as an entry while there are layers, to drop shapes on', () => {
    const { ids, document, layer } = storeWith(0);

    expect(outline(document())).toEqual([{ layerId: null, groups: [], shapesIds: ids }]);

    layer('walls', ids[0]);

    expect(outline(document()).map((entry) => entry.layerId)).toEqual(['walls', null]);
});

describe('filtering the outline', () => {
    it('keeps the shapes whose names contain the text, in any case, and what holds them', () => {
        const { ids, select, run, document, layer } = storeWith(0, 20, 40, 60);

        layer('walls', ids[0], ids[1]);
        layer('pipes', ids[2]);
        select(ids[0], ids[1]);
        run('group');

        const [groupId] = Object.keys(document().groups);
        const filtered = (text: string) =>
            filterOutline(outline(document()), document().shapes, text);

        expect(filtered('RECTANGLE-2')).toEqual([
            { layerId: 'walls', groups: [{ groupId, shapesIds: [ids[1]] }], shapesIds: [] }
        ]);
        expect(filtered('rectangle-4')).toEqual([
            { layerId: null, groups: [], shapesIds: [ids[3]] }
        ]);
        expect(filtered('door')).toEqual([]);
        expect(filtered('  ')).toEqual(outline(document()));
    });

    it('is typed with the search action, and neither saved nor shown to other copies', async () => {
        const copies = await createCopies(2, (store) => store.actions.addShape(square(0)));
        const [a, b] = copies;

        edit(a, (actions) => actions.search('rect'));
        deliver(b);

        expect(shownDocument(a).filter).toBe('rect');
        expect(shownDocument(b).filter).toBe('');
        expect(JSON.stringify(serializePersistedState(a.store.state))).not.toContain('"rect"');
    });
});

describe('showing only one layer', () => {
    function plan() {
        const setup = storeWith(0, 20, 40);

        setup.layer('walls', setup.ids[0]);
        setup.layer('pipes', setup.ids[1]);

        const shown = () => setup.ids.filter((id) => isShapeVisible(setup.document(), id));

        return { ...setup, shown };
    }

    it('shows that layer and the shapes on no layer, and all again when repeated', () => {
        const { store, ids, shown, document } = plan();

        store.actions.showOnlyLayer('pipes');
        expect(shown()).toEqual([ids[1], ids[2]]);
        expect(Object.values(document().layers).map((layer) => layer.visible)).toEqual([
            true,
            true
        ]);

        store.actions.showOnlyLayer('walls');
        expect(shown()).toEqual([ids[0], ids[2]]);

        store.actions.showOnlyLayer('walls');
        expect(shown()).toEqual(ids);
    });

    it('shows a layer hidden by its own setting while it is the one shown', () => {
        const { store, ids, shown } = plan();

        store.actions.hideLayer('pipes');
        expect(shown()).toEqual([ids[0], ids[2]]);

        store.actions.showOnlyLayer('pipes');
        expect(shown()).toEqual([ids[1], ids[2]]);
    });

    it('keeps shapes of other layers from being pressed', () => {
        const { store } = plan();

        store.actions.showOnlyLayer('pipes');
        store.actions.events.setCurrentPosition({ x: 5, y: 5 });

        expect(store.actions.selectShapeAtPointer()).toBe(false);
    });

    it('is done by the Highlight layer command for the layer of the selected shapes', () => {
        const { store, ids, shown, select, run, document } = plan();

        select(ids[1]);
        expect(run('highlightLayer')).toBeUndefined();
        expect(document().shownLayerId).toBe('pipes');
        expect(shown()).toEqual([ids[1], ids[2]]);

        // Again, with or without a selection, it shows every layer.
        store.actions.unselectShapes();
        expect(run('Highlight layer')).toBeUndefined();
        expect(shown()).toEqual(ids);
    });

    it('is not available without one layer to highlight', () => {
        const { ids, select, run, document } = plan();
        const refused = 'Highlight layer is not available right now';

        expect(run('highlightLayer')).toBe(refused);

        select(ids[2]);
        expect(run('highlightLayer')).toBe(refused);

        select(ids[0], ids[1]);
        expect(run('highlightLayer')).toBe(refused);
        expect(document().shownLayerId).toBeUndefined();
    });

    it('is this screen’s own: it is neither saved nor shown to other copies', async () => {
        const copies = await createCopies(2, (store) => {
            store.actions.addShape(square(0));
            store.actions.addLayer({
                id: 'walls',
                shapesIds: [...store.state.currentDocument.shapesIds]
            });
            store.actions.addLayer({ id: 'pipes' });
        });
        const [a, b] = copies;

        edit(a, (actions) => actions.showOnlyLayer('pipes'));
        deliver(b);

        expect(shownDocument(b).shownLayerId).toBeUndefined();
        expect(JSON.stringify(serializePersistedState(a.store.state))).not.toContain(
            'shownLayerId'
        );
    });
});
