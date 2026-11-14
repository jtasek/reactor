import * as Y from 'yjs';
import { restoreContent } from '../server/restoreContent';
import { createCopies, DOCUMENT_ID, edit, shownDocument } from './support/collaboration';

const rectangle = (x: number) => ({
    type: 'rectangle' as const,
    position: { x, y: x },
    size: { width: 5, height: 5 }
});

describe('a restore on the server', () => {
    it("clears each copy's undo history, so undo cannot reach past it", async () => {
        const [ada, grace] = await createCopies(2);
        const server = new Y.Doc();
        const sync = () => {
            for (const copy of [ada, grace]) {
                Y.applyUpdate(server, copy.collaboration.state(DOCUMENT_ID));
            }
        };

        edit(ada, (actions) => actions.addShape(rectangle(1)));
        sync();
        const snapshot = new Y.Doc();
        Y.applyUpdate(snapshot, Y.encodeStateAsUpdate(server));

        const [id] = Object.keys(shownDocument(ada).shapes);
        edit(ada, (actions) => actions.updateShape({ id, position: { x: 50, y: 50 } }));
        edit(ada, (actions) => actions.addShape(rectangle(9)));
        sync();

        const before = Y.encodeStateVector(server);
        restoreContent(server, snapshot);
        const restore = Y.encodeStateAsUpdate(server, before);
        ada.collaboration.receive(DOCUMENT_ID, restore);
        grace.collaboration.receive(DOCUMENT_ID, Y.encodeStateAsUpdate(server));

        expect(
            Object.values(shownDocument(ada).shapes).map((shape) =>
                'position' in shape ? shape.position : undefined
            )
        ).toEqual([{ x: 1, y: 1 }]);
        expect(shownDocument(ada).history).toEqual({ canUndo: false, canRedo: false });

        // Undo has nothing left, so it cannot remove what the restore brought back.
        ada.collaboration.undo(DOCUMENT_ID);
        expect(Object.keys(shownDocument(ada).shapes)).toEqual([id]);

        // Edits after the restore undo as usual.
        edit(ada, (actions) => actions.addShape(rectangle(20)));
        expect(Object.keys(shownDocument(ada).shapes)).toHaveLength(2);
        ada.collaboration.undo(DOCUMENT_ID);
        expect(Object.keys(shownDocument(ada).shapes)).toEqual([id]);
    });
});
