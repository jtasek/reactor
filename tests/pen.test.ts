import { registerCommand, registerTool } from 'src/app/actions/startup';
import type { Path } from 'src/app/types';
import type { KeyPress } from 'src/events/shortcuts';
import {
    FinishPathCommand,
    PenTool,
    RemovePathPointCommand,
    placedPoint
} from 'src/tools/components/Pen';
import { createTestStore } from './support/store';

const escape: KeyPress = {
    key: 'Escape',
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false
};
const leaveSomething = vi.fn();

registerTool(PenTool);
registerCommand(RemovePathPointCommand);
registerCommand(FinishPathCommand);
registerCommand({
    id: 'leave-something',
    name: 'Leave something',
    category: 'groups',
    shortcut: 'escape',
    canExecute: () => true,
    execute: leaveSomething
});

const click = (store: ReturnType<typeof createTestStore>['store'], x: number, y: number) => {
    store.actions.events.beginGesture({ pointerId: 1, position: { x, y } });
    store.actions.events.endGesture({ pointerId: 1, position: { x, y } });
};

describe('the Pen', () => {
    it('places a corner on a click and a smooth point, handles mirrored, on a drag', () => {
        expect(placedPoint({ x: 10, y: 10 }, { x: 11, y: 10 }, 1)).toEqual({ x: 10, y: 10 });
        expect(placedPoint({ x: 10, y: 10 }, { x: 40, y: 20 }, 1)).toEqual({
            x: 10,
            y: 10,
            in: { x: -20, y: 0 },
            out: { x: 40, y: 20 }
        });
    });

    it('keeps the path drawn so far on Escape, before what else Escape does', () => {
        const { store } = createTestStore();
        store.actions.tools.activateTool('pen');
        click(store, 0, 0);
        click(store, 50, 0);
        expect(store.state.currentDocument.shapesIds).toHaveLength(0);

        store.actions.events.pressShortcut(escape);

        const [path] = Object.values(store.state.currentDocument.shapes) as Path[];
        expect(path).toMatchObject({
            type: 'path',
            points: [
                { x: 0, y: 0 },
                { x: 50, y: 0 }
            ]
        });
        expect(store.state.tools.penDraft).toEqual([]);
        expect(store.state.tools.activeToolsIds).toEqual(['select']);
        expect(leaveSomething).not.toHaveBeenCalled();

        store.actions.events.pressShortcut(escape);
        expect(leaveSomething).toHaveBeenCalledOnce();
    });

    it('takes back the last point on Backspace, and leaves Backspace alone after', () => {
        const { store } = createTestStore();
        store.actions.tools.activateTool('pen');
        click(store, 0, 0);
        click(store, 50, 0);

        expect(store.actions.events.pressShortcut({ ...escape, key: 'Backspace' })).toBe(true);
        expect(store.state.tools.penDraft).toEqual([{ x: 0, y: 0 }]);
        store.actions.events.pressShortcut({ ...escape, key: 'Backspace' });
        expect(store.state.tools.penDraft).toEqual([]);
        expect(store.actions.events.pressShortcut({ ...escape, key: 'Backspace' })).toBe(false);
    });

    it('keeps the path when another tool is chosen, and drops a lone point', () => {
        const { store } = createTestStore();
        store.actions.tools.activateTool('pen');
        click(store, 0, 0);
        store.actions.tools.activateTool('select');

        expect(store.state.currentDocument.shapesIds).toHaveLength(0);
        expect(store.state.tools.penDraft).toEqual([]);
    });
});

describe('Enter and Escape without a path being drawn', () => {
    it('are left to the page, unless another command takes them', () => {
        const { store } = createTestStore();

        expect(store.actions.events.pressShortcut({ ...escape, key: 'Enter' })).toBe(false);
    });
});
