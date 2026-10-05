import { registerCommand } from 'src/app/actions/startup';
import { hoveredLockedItem } from 'src/app/membership';
import type { ShapeInput } from 'src/app/types';
import * as commands from 'src/commands';
import { createTestStore } from './support/store';

// Commands are registered by application startup, which the test store skips.
Object.values(commands).forEach(registerCommand);

const square = (x: number): ShapeInput => ({
    type: 'rectangle',
    position: { x, y: 0 },
    size: { width: 10, height: 10 }
});

/** Squares at x 0, 20 and 60, none selected, with the pointer over the canvas. */
function setup() {
    const { store } = createTestStore();

    [0, 20, 60].forEach((x) => store.actions.addShape(square(x)));
    store.actions.unselectShapes();
    store.actions.events.movePointer({ pointerId: 1, position: { x: 5, y: 5 } });

    const document = () => store.state.currentDocument;
    const [first, second, third] = document().shapesIds;
    const hovered = () =>
        hoveredLockedItem(document(), store.state.enteredGroupId, store.state.events.pointer);
    const hover = (id: string) => {
        document().shapesIds.forEach((other) => store.actions.deactivateShape(other));
        store.actions.activateShape(id);
    };

    return { store, document, first, second, third, hovered, hover };
}

describe('hoveredLockedItem', () => {
    it('is a locked shape under the pointer, until it is unlocked or selected', () => {
        const { store, first, hovered, hover } = setup();

        hover(first);
        expect(hovered()).toBeNull();

        store.actions.lockShape(first);
        expect(hovered()).toEqual({ kind: 'shape', id: first });

        store.actions.selectShape(first);
        expect(hovered()).toBeNull();

        store.actions.unselectShapes();
        store.actions.unlockShape(first);
        expect(hovered()).toBeNull();
    });

    it('is none off the canvas or during a drag', () => {
        const { store, first, hovered, hover } = setup();

        store.actions.lockShape(first);
        hover(first);
        store.actions.events.leaveSurface();
        expect(hovered()).toBeNull();

        store.actions.events.movePointer({ pointerId: 1, position: { x: 30, y: 5 } });
        store.actions.events.beginGesture({ pointerId: 1, position: { x: 30, y: 5 } });
        store.actions.events.movePointer({ pointerId: 1, position: { x: 40, y: 20 } });
        hover(first);
        expect(hovered()).toBeNull();
    });

    it('is a locked group, over one of its shapes or between them in its box', () => {
        const { store, document, first, third, hovered, hover } = setup();

        store.actions.selectShape(first);
        store.actions.selectShape(third);
        store.actions.submitCommandLine('group');
        const groupId = Object.keys(document().groups)[0];

        store.actions.unselectShapes();
        store.actions.toggleGroupLocked(groupId);

        hover(third);
        expect(hovered()).toEqual({ kind: 'group', id: groupId });

        store.actions.deactivateShape(third);
        store.actions.events.movePointer({ pointerId: 1, position: { x: 40, y: 5 } });
        expect(hovered()).toEqual({ kind: 'group', id: groupId });
    });

    it('is not a locked shape in an unlocked group, whose press selects the group', () => {
        const { store, document, first, third, hovered, hover } = setup();

        store.actions.selectShape(first);
        store.actions.selectShape(third);
        store.actions.submitCommandLine('group');
        store.actions.unselectShapes();
        store.actions.lockShape(first);
        hover(first);

        expect(Object.keys(document().groups)).toHaveLength(1);
        expect(hovered()).toBeNull();
    });

    it('is the group double-clicked into once that group is locked', () => {
        const { store, document, first, third, hovered, hover } = setup();

        store.actions.selectShape(first);
        store.actions.selectShape(third);
        store.actions.submitCommandLine('group');
        const groupId = Object.keys(document().groups)[0];

        store.actions.events.setCurrentPosition({ x: 5, y: 5 });
        store.actions.enterGroupAtPointer();
        expect(store.state.enteredGroupId).toBe(groupId);

        store.actions.unselectShapes();
        store.actions.toggleGroupLocked(groupId);
        hover(first);

        expect(hovered()).toEqual({ kind: 'group', id: groupId });
    });
});
