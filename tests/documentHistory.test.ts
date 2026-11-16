import * as Y from 'yjs';
import { snapshotDocument } from 'src/app/services/documentHistory';
import { createCopies, DOCUMENT_ID, edit } from './support/collaboration';

describe('a snapshot shown in Document history', () => {
    it('reads as the document it was, under the document shown', async () => {
        const [copy] = await createCopies(1, (store) =>
            store.actions.updateDocument({ id: DOCUMENT_ID, name: 'Plan' })
        );

        edit(copy, (actions) =>
            actions.addShape({
                type: 'rectangle',
                position: { x: 10, y: 20 },
                size: { width: 30, height: 40 }
            })
        );

        const document = snapshotDocument(copy.collaboration.state(DOCUMENT_ID), 'restored')!;

        expect(document.id).toBe('restored');
        expect(document.name).toBe('Plan');
        expect(
            Object.values(document.shapes).map((shape) =>
                'position' in shape ? shape.position : undefined
            )
        ).toEqual([{ x: 10, y: 20 }]);
        expect(document.shapesIds).toHaveLength(1);
    });

    it('is undefined when the content cannot be read', () => {
        expect(snapshotDocument(new Uint8Array([1, 2, 3]), 'broken')).toBeUndefined();
    });

    it('reads an empty document', () => {
        const document = snapshotDocument(Y.encodeStateAsUpdate(new Y.Doc()), 'empty');

        expect(document && Object.keys(document.shapes)).toEqual([]);
    });
});
