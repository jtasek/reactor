import { HideCommand, LockCommand, UnlockCommand } from 'src/commands/visibility';
import { DetachInstanceCommand } from 'src/commands/component';
import { createTestStore } from './support/store';

function setup() {
    const { store } = createTestStore();
    const frame = store.actions.editFrame({
        kind: 'add',
        position: { x: 0, y: 0 },
        size: { width: 300, height: 200 }
    })!;
    const add = (parentFrameId?: string) => {
        store.actions.addShape({
            type: 'rectangle',
            position: { x: 10, y: 10 },
            size: { width: 20, height: 20 },
            ...(parentFrameId ? { parentFrameId } : {})
        });

        return store.state.currentDocument.shapesIds.at(-1)!;
    };
    const select = (ids: string[]) => {
        store.actions.unselectShapes();
        ids.forEach((id) => store.actions.selectShape(id));
    };
    const can = (command: { canExecute: (context: never) => boolean }) =>
        command.canExecute({ state: store.state } as never);

    return { store, frame, add, select, can };
}

describe('Hide, Lock and Unlock availability', () => {
    it('offers Hide and Lock for unlocked shapes, Unlock only once one is locked', () => {
        const { store, add, select, can } = setup();
        const ids = [add(), add()];

        select(ids);
        expect([can(HideCommand), can(LockCommand), can(UnlockCommand)]).toEqual([
            true,
            true,
            false
        ]);

        store.actions.lockSelection();
        select(ids);
        expect([can(HideCommand), can(LockCommand), can(UnlockCommand)]).toEqual([
            true,
            false,
            true
        ]);
    });

    it('offers nothing for shapes inside a locked frame', () => {
        const { store, frame, add, select, can } = setup();
        const inside = add(frame);

        store.actions.editFrame({ kind: 'toggle', id: frame, flag: 'locked' });
        select([inside]);

        expect([can(HideCommand), can(LockCommand), can(UnlockCommand)]).toEqual([
            false,
            false,
            false
        ]);
    });

    it('still finds an editable shape selected after ones in a locked frame', () => {
        const { store, frame, add, select, can } = setup();
        const inside = add(frame);
        const outside = add();

        store.actions.editFrame({ kind: 'toggle', id: frame, flag: 'locked' });
        select([inside, outside]);

        expect(can(HideCommand)).toBe(true);
        expect(can(LockCommand)).toBe(true);
    });
});

describe('Detach instance availability', () => {
    it('needs a selected instance that is not locked', () => {
        const { store, add, select, can } = setup();
        const member = add();

        store.actions.addComponent({ id: 'card', shapesIds: [member], sourceOnly: true });
        store.actions.addShape({
            type: 'instance',
            componentId: 'card',
            position: { x: 100, y: 100 },
            overrides: {}
        } as never);
        const instance = store.state.currentDocument.shapesIds.at(-1)!;
        const plain = add();

        select([plain]);
        expect(can(DetachInstanceCommand)).toBe(false);
        select([plain, instance]);
        expect(can(DetachInstanceCommand)).toBe(true);
        store.actions.lockSelection();
        select([plain, instance]);
        expect(can(DetachInstanceCommand)).toBe(false);
    });
});
