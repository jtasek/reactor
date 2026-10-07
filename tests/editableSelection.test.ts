import type { ShapeInput } from 'src/app/types';
import { DeleteCommand, GroupCommand } from 'src/commands';
import { createTestStore } from './support/store';

const square = (x: number): ShapeInput => ({
    type: 'rectangle',
    position: { x, y: 0 },
    size: { width: 10, height: 10 },
    selected: true
});

describe('the editable selection the commands act on', () => {
    it('follows locks while the selection stays the same', () => {
        const { store } = createTestStore();

        store.actions.addShape(square(0));
        store.actions.addShape(square(20));

        const [first, second] = store.state.currentDocument.shapesIds;
        const editable = () => [...store.state.currentDocument.editableSelectedShapesIds];
        const canDelete = () => DeleteCommand.canExecute({ state: store.state });
        const canGroup = () => GroupCommand.canExecute({ state: store.state });

        expect(editable()).toEqual([first, second]);
        expect(canGroup()).toBe(true);

        store.actions.lockShape(first);
        expect(editable()).toEqual([second]);
        expect(canGroup()).toBe(false);
        expect(canDelete()).toBe(true);

        store.actions.unlockShape(first);
        expect(editable()).toEqual([first, second]);

        store.actions.groupSelection();
        const [groupId] = store.state.currentDocument.groupsIds;

        store.actions.lockGroup(groupId);
        expect(editable()).toEqual([]);
        expect(canDelete()).toBe(false);

        store.actions.unlockGroup(groupId);
        expect(editable()).toEqual([first, second]);
        expect(canDelete()).toBe(true);
    });
});
