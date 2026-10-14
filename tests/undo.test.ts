import { RedoCommand, UndoCommand } from 'src/commands';
import {
    type Copy,
    DOCUMENT_ID,
    createCopies,
    edit,
    expectConsistent,
    settle,
    sharedContent,
    shownDocument
} from './support/collaboration';

const rectangle = (x = 0, y = 0) => ({
    type: 'rectangle' as const,
    position: { x, y },
    size: { width: 20, height: 10 }
});

const undo = (copy: Copy) => copy.collaboration.undo(DOCUMENT_ID);
const redo = (copy: Copy) => copy.collaboration.redo(DOCUMENT_ID);
const history = (copy: Copy) => shownDocument(copy).history;

describe('undo', () => {
    it('undoes and redoes a shape a copy added, in every copy', async () => {
        const copies = await createCopies(2);
        const [a, b] = copies;

        edit(a, (actions) => actions.addShape(rectangle()));
        const [id] = shownDocument(a).shapesIds;

        undo(a);
        settle(copies);
        copies.forEach((copy) => expect(shownDocument(copy).shapesIds).toEqual([]));

        redo(a);
        settle(copies);
        copies.forEach((copy) => expect(shownDocument(copy).shapesIds).toEqual([id]));
        expect(sharedContent(b)).toEqual(sharedContent(a));
    });

    it('leaves the changes other copies made', async () => {
        const copies = await createCopies(2, (store) => store.actions.addShape(rectangle()));
        const [a, b] = copies;
        const [id] = shownDocument(a).shapesIds;

        edit(a, (actions) => actions.updateShape({ id, name: 'from a' }));
        settle(copies);
        edit(b, (actions) => actions.updateShape({ id, position: { x: 50, y: 60 } }));
        edit(b, (actions) => actions.addShape(rectangle(100)));
        settle(copies);

        undo(a);
        settle(copies);

        copies.forEach((copy) => {
            expect(shownDocument(copy).shapes[id]).toMatchObject({
                name: 'rectangle-1',
                position: { x: 50, y: 60 }
            });
            expect(shownDocument(copy).shapesIds).toHaveLength(2);
        });
        expect(history(b)).toEqual({ canUndo: true, canRedo: false });
    });

    it('never undoes another copy’s change to the same field', async () => {
        const copies = await createCopies(2, (store) => store.actions.addShape(rectangle()));
        const [a, b] = copies;
        const [id] = shownDocument(a).shapesIds;

        edit(a, (actions) => actions.updateShape({ id, name: 'from a' }));
        settle(copies);
        edit(b, (actions) => actions.updateShape({ id, name: 'from b' }));
        settle(copies);

        undo(a);
        settle(copies);

        copies.forEach((copy) => expect(shownDocument(copy).shapes[id].name).toBe('from b'));
    });

    it('has nothing to undo once a document opens', async () => {
        const copies = await createCopies(2, (store) => store.actions.addShape(rectangle()));

        copies.forEach((copy) => {
            expect(history(copy)).toEqual({ canUndo: false, canRedo: false });
            undo(copy);
        });
        settle(copies);

        copies.forEach((copy) => expect(shownDocument(copy).shapesIds).toHaveLength(1));
    });

    it('tells the store what can be undone and redone', async () => {
        const copies = await createCopies(1);
        const [a] = copies;

        edit(a, (actions) => actions.addShape(rectangle()));
        expect(history(a)).toEqual({ canUndo: true, canRedo: false });

        undo(a);
        expect(history(a)).toEqual({ canUndo: false, canRedo: true });

        redo(a);
        expect(history(a)).toEqual({ canUndo: true, canRedo: false });

        undo(a);
        edit(a, (actions) => actions.addShape(rectangle(40)));
        expect(history(a)).toEqual({ canUndo: true, canRedo: false });
    });

    it('brings back a deleted shape with its place in its group', async () => {
        const copies = await createCopies(2, (store) => {
            store.actions.addShape(rectangle());
            store.actions.addShape(rectangle(40));
            store.actions.addGroup({
                id: 'group',
                shapesIds: store.state.currentDocument.shapesIds
            });
        });
        const [a, b] = copies;
        const [first, second] = shownDocument(a).shapesIds;

        edit(a, (actions) => actions.removeShape(first));
        settle(copies);
        expect(shownDocument(b).groups.group.shapesIds).toEqual([second]);

        undo(a);
        settle(copies);

        copies.forEach((copy) => {
            expect(shownDocument(copy).shapesIds).toEqual([first, second]);
            expect([...shownDocument(copy).groups.group.shapesIds].sort()).toEqual(
                [first, second].sort()
            );
            expectConsistent(copy);
        });
    });

    it('undoes changes made while sharing was held as one', async () => {
        const copies = await createCopies(2, (store) => store.actions.addShape(rectangle()));
        const [a] = copies;
        const [id] = shownDocument(a).shapesIds;

        a.collaboration.pause();
        edit(a, (actions) => actions.updateShape({ id, position: { x: 10, y: 0 } }));
        edit(a, (actions) => actions.updateShape({ id, position: { x: 20, y: 0 } }));
        undo(a);
        expect(shownDocument(a).shapes[id]).toMatchObject({ position: { x: 20, y: 0 } });
        a.collaboration.resume();
        a.collaboration.flush();

        undo(a);
        settle(copies);

        copies.forEach((copy) =>
            expect(shownDocument(copy).shapes[id]).toMatchObject({ position: { x: 0, y: 0 } })
        );
    });

    it('undoes a change that has not been shared yet', async () => {
        const copies = await createCopies(2);
        const [a] = copies;

        a.store.actions.addShape(rectangle());
        undo(a);
        settle(copies);

        copies.forEach((copy) => expect(shownDocument(copy).shapesIds).toEqual([]));
    });

    it('runs from the Undo and Redo commands', async () => {
        const copies = await createCopies(2);
        const [a, b] = copies;
        const run = (command: typeof UndoCommand) => a.store.actions.runCommand(command);

        expect(run(UndoCommand)).toBe(false);
        edit(a, (actions) => actions.addShape(rectangle()));

        expect(run(UndoCommand)).toBe(true);
        expect(run(RedoCommand)).toBe(true);
        settle(copies);

        expect(shownDocument(b).shapesIds).toHaveLength(1);
        expect(history(a)).toEqual({ canUndo: true, canRedo: false });
    });
});
