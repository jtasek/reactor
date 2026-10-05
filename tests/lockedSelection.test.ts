import { registerCommand, registerTool } from 'src/app/actions/startup';
import type { Point, ShapeInput } from 'src/app/types';
import * as commands from 'src/commands';
import { SelectTool } from 'src/tools';
import { createTestStore } from './support/store';

// Commands and tools are registered by application startup, which the test store skips.
Object.values(commands).forEach(registerCommand);
registerTool(SelectTool);

const square = (x: number): ShapeInput => ({
    type: 'rectangle',
    position: { x, y: 0 },
    size: { width: 10, height: 10 }
});

/** A store with a 10 by 10 square at each x, none selected. */
function setup(...xs: number[]) {
    const { store } = createTestStore();

    xs.forEach((x) => store.actions.addShape(square(x)));
    store.actions.unselectShapes();

    const document = () => store.state.currentDocument;
    const ids = [...document().shapesIds];
    const selected = () => document().shapesIds.filter((id) => document().shapes[id].selected);
    const position = (id: string) => {
        const shape = document().shapes[id];

        return shape.type === 'rectangle' ? { ...shape.position } : null;
    };
    const drag = (from: Point, to: Point) => {
        store.actions.events.beginGesture({ pointerId: 1, position: from });
        store.actions.events.movePointer({ pointerId: 1, position: to });
        store.actions.events.endGesture({ pointerId: 1, position: to });
    };
    const click = (at: Point) => drag(at, at);

    return { store, document, ids, selected, position, drag, click };
}

describe('a locked item', () => {
    it('is selected by a click, and a click on empty canvas leaves it', () => {
        const { store, ids, selected, position, click } = setup(0);

        store.actions.lockShape(ids[0]);
        click({ x: 5, y: 5 });

        expect(selected()).toEqual([ids[0]]);
        expect(position(ids[0])).toEqual({ x: 0, y: 0 });

        click({ x: 100, y: 100 });
        expect(selected()).toEqual([]);
    });

    it('is not moved by a drag from it, which draws a box that skips it', () => {
        const { store, ids, selected, position, drag } = setup(0, 30);

        store.actions.lockShape(ids[0]);
        drag({ x: 5, y: 5 }, { x: 45, y: 15 });

        expect(selected()).toEqual([ids[1]]);
        expect(position(ids[0])).toEqual({ x: 0, y: 0 });
        expect(position(ids[1])).toEqual({ x: 30, y: 0 });
    });

    it('lets an unlocked shape under it take the press', () => {
        const { store, ids, selected, position, drag } = setup(0, 0);

        store.actions.lockShape(ids[1]);
        drag({ x: 5, y: 5 }, { x: 25, y: 5 });

        expect(selected()).toEqual([ids[0]]);
        expect(position(ids[0])).toEqual({ x: 20, y: 0 });
        expect(position(ids[1])).toEqual({ x: 0, y: 0 });
    });

    it('is a locked group, selected as one by a click on a shape or between them', () => {
        const { store, document, ids, selected, position, click, drag } = setup(0, 60);

        ids.forEach((id) => store.actions.selectShape(id));
        store.actions.submitCommandLine('group');
        const groupId = Object.keys(document().groups)[0];

        store.actions.unselectShapes();
        store.actions.toggleGroupLocked(groupId);

        click({ x: 35, y: 5 });
        expect(document().selectedGroupsIds).toEqual([groupId]);

        click({ x: 100, y: 100 });
        click({ x: 65, y: 5 });
        expect(selected()).toEqual(ids);

        drag({ x: 5, y: 5 }, { x: 25, y: 5 });
        expect(position(ids[0])).toEqual({ x: 0, y: 0 });
    });

    it('is selected by a click that slips less than a drag', () => {
        const { store, ids, selected, drag } = setup(0);

        store.actions.lockShape(ids[0]);
        drag({ x: 5, y: 5 }, { x: 7, y: 5 });

        expect(selected()).toEqual([ids[0]]);
    });

    it('is not selected by a drag from it that comes back where it began', () => {
        const { store, ids, selected } = setup(0, 30);
        const { events } = store.actions;

        store.actions.lockShape(ids[0]);
        events.beginGesture({ pointerId: 1, position: { x: 5, y: 5 } });
        events.movePointer({ pointerId: 1, position: { x: 45, y: 15 } });
        events.movePointer({ pointerId: 1, position: { x: 6, y: 5 } });
        events.endGesture({ pointerId: 1, position: { x: 6, y: 5 } });

        expect(selected()).toEqual([]);
    });

    it('keeps a selection it is in, as an unlocked shape does', () => {
        const { store, ids, selected, click } = setup(0, 30);

        store.actions.lockShape(ids[0]);
        ids.forEach((id) => store.actions.selectShape(id));
        click({ x: 5, y: 5 });

        expect(selected()).toEqual(ids);
    });

    it('is selected alone in the group double-clicked into', () => {
        const { store, document, ids, selected, click } = setup(0, 60);

        ids.forEach((id) => store.actions.selectShape(id));
        store.actions.submitCommandLine('group');
        const groupId = Object.keys(document().groups)[0];

        store.actions.events.setCurrentPosition({ x: 65, y: 5 });
        store.actions.enterGroupAtPointer();
        store.actions.lockShape(ids[0]);
        click({ x: 5, y: 5 });

        expect(store.state.enteredGroupId).toBe(groupId);
        expect(selected()).toEqual([ids[0]]);
    });

    it('selects only the shown shapes of a locked group', () => {
        const { store, document, ids, selected, click } = setup(0, 20, 60);

        ids.forEach((id) => store.actions.selectShape(id));
        store.actions.submitCommandLine('group');
        const groupId = Object.keys(document().groups)[0];

        store.actions.unselectShapes();
        store.actions.toggleShapeVisible(ids[1]);
        store.actions.toggleGroupLocked(groupId);
        click({ x: 5, y: 5 });

        expect(selected()).toEqual([ids[0], ids[2]]);
    });
});
