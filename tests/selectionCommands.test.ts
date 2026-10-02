import { registerCommand } from 'src/app/actions/startup';
import type { ShapeInput } from 'src/app/types';
import { isShapeLocked, isShapeVisible } from 'src/app/utils';
import * as commands from 'src/commands';
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
    const shown = () => ids.filter((id) => isShapeVisible(document(), id));
    const locked = () => ids.filter((id) => isShapeLocked(document(), id));

    return { store, document, ids, select, run, shown, locked };
}

describe('Bring to front and Send to back', () => {
    it('move the selected shapes over or under the others, in their own order', () => {
        const { ids, select, run, document } = storeWith(0, 20, 40);

        select(ids[0], ids[1]);
        expect(run('Bring to front')).toBeUndefined();
        expect(document().shapesIds).toEqual([ids[2], ids[0], ids[1]]);

        select(ids[1]);
        expect(run('send-to-back')).toBeUndefined();
        expect(document().shapesIds).toEqual([ids[1], ids[2], ids[0]]);
    });

    it('are not available without a selection they may move', () => {
        const { store, ids, select, run } = storeWith(0, 20);

        expect(run('Bring to front')).toBe('Bring to front is not available right now');

        select(ids[0]);
        store.actions.lockShape(ids[0]);
        expect(run('Send to back')).toBe('Send to back is not available right now');
    });
});

describe('Hide and Show all', () => {
    it('hide the selected shapes, which are then no longer selected, and show them again', () => {
        const { ids, select, run, shown, document } = storeWith(0, 20);

        select(ids[0]);
        expect(run('Hide')).toBeUndefined();
        expect(shown()).toEqual([ids[1]]);
        expect(document().shapes[ids[0]].selected).toBe(false);

        expect(run('Show all')).toBeUndefined();
        expect(shown()).toEqual(ids);
        expect(document().selectedShapesIds).toEqual([]);
    });

    it('hide a group selected as one as a group', () => {
        const { ids, select, run, shown, document } = storeWith(0, 20, 40);

        select(ids[0], ids[1]);
        run('group');

        const [group] = Object.values(document().groups);

        expect(run('Hide')).toBeUndefined();
        expect(group.visible).toBe(false);
        expect(document().shapes[ids[0]].visible).toBe(true);
        expect(shown()).toEqual([ids[2]]);

        run('Show all');
        expect(shown()).toEqual(ids);
    });

    it('show hidden layers too', () => {
        const { store, ids, run, shown } = storeWith(0);

        store.actions.addLayer({ id: 'walls', shapesIds: ids });
        store.actions.hideLayer('walls');
        expect(run('Show all')).toBeUndefined();
        expect(shown()).toEqual(ids);
    });

    it('show the layers a highlighted layer left out', () => {
        const { store, ids, run, shown, document } = storeWith(0, 20);

        store.actions.addLayer({ id: 'walls', shapesIds: [ids[0]] });
        store.actions.addLayer({ id: 'pipes', shapesIds: [ids[1]] });
        store.actions.showOnlyLayer('walls');
        expect(shown()).toEqual([ids[0]]);

        expect(run('Show all')).toBeUndefined();
        expect(shown()).toEqual(ids);
        expect(document().shownLayerId).toBeUndefined();
    });

    it('are available only with something to hide or to show', () => {
        const { run } = storeWith(0);

        expect(run('Hide')).toBe('Hide is not available right now');
        expect(run('Show all')).toBe('Show all is not available right now');
    });
});

describe('Lock and Unlock', () => {
    it('lock the selected shapes, which stay selected, and unlock them', () => {
        const { ids, select, run, locked, document } = storeWith(0, 20);

        select(ids[0]);
        expect(run('Lock')).toBeUndefined();
        expect(locked()).toEqual([ids[0]]);
        expect(document().selectedShapesIds).toEqual([ids[0]]);
        expect(run('Lock')).toBe('Lock is not available right now');

        expect(run('Unlock')).toBeUndefined();
        expect(locked()).toEqual([]);
        expect(run('Unlock')).toBe('Unlock is not available right now');
    });

    it('lock and unlock a group selected as one as a group', () => {
        const { ids, select, run, locked, document } = storeWith(0, 20);

        select(...ids);
        run('group');

        const [group] = Object.values(document().groups);

        run('Lock');
        expect(group.locked).toBe(true);
        expect(document().shapes[ids[0]].locked).toBe(false);
        expect(locked()).toEqual(ids);

        run('Unlock');
        expect(locked()).toEqual([]);
    });
});
