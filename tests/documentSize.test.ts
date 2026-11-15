import * as Yjs from 'yjs';
import { createDocument, createShape } from 'src/app/factories';
import { Collaboration } from 'src/app/services/collaboration';
import {
    MAX_UPLOAD_BYTES,
    SIZE_WARNING_BYTES,
    formatSize,
    measureDocument,
    sizeLevel,
    tooLargeMessage
} from 'src/app/services/documentSize';
import { MAX_MOVE_BYTES } from 'src/app/services/signedOutDocuments';
import { MAX_MESSAGE } from '../server/sync';

/** A document holding one rectangle named `text`, open in a collaboration. */
async function opened(text: string) {
    const document = createDocument({ id: 'large', name: 'Large' });
    const shape = createShape({
        type: 'rectangle',
        position: { x: 0, y: 0 },
        size: { width: 20, height: 10 },
        order: 'a0',
        name: text
    });

    document.shapes[shape.id] = shape;

    const collaboration = new Collaboration();

    await collaboration.initialize({
        getDocument: () => document,
        applyRemoteChanges: () => {},
        addMutationListener: () => () => {}
    });
    collaboration.open(document.id);
    onTestFinished(() => collaboration.dispose());

    return { collaboration, document };
}

describe('document size', () => {
    it('warns from 3 MiB and refuses what the server cannot take in one message', () => {
        expect(SIZE_WARNING_BYTES).toBe(3 * 1024 * 1024);
        expect(sizeLevel(SIZE_WARNING_BYTES - 1)).toBe('fits');
        expect(sizeLevel(SIZE_WARNING_BYTES)).toBe('large');
        expect(sizeLevel(MAX_UPLOAD_BYTES)).toBe('large');
        expect(sizeLevel(MAX_UPLOAD_BYTES + 1)).toBe('tooLarge');
    });

    it('leaves room in the server’s largest message for the document’s id', () => {
        expect(MAX_UPLOAD_BYTES).toBe(MAX_MESSAGE - 1024);
        expect(MAX_MOVE_BYTES).toBe(MAX_UPLOAD_BYTES);
    });

    it('measures a document’s whole shared state', async () => {
        const { collaboration, document } = await opened('x'.repeat(SIZE_WARNING_BYTES));
        const bytes = measureDocument(() => collaboration.state(document.id), Yjs)!;

        expect(bytes).toBe(collaboration.state(document.id).byteLength);
        expect(bytes).toBeGreaterThan(SIZE_WARNING_BYTES);
        expect(sizeLevel(bytes)).toBe('large');
    });

    it('measures nothing for a document that is not open', async () => {
        const { collaboration } = await opened('small');

        expect(measureDocument(() => collaboration.state('missing'), Yjs)).toBeUndefined();
    });

    it('leaves out deleted content kept for undo, which other copies drop', async () => {
        const { collaboration, document } = await opened('x'.repeat(SIZE_WARNING_BYTES));
        const doc = new Yjs.Doc({ gc: false });

        Yjs.applyUpdate(doc, collaboration.state(document.id));
        doc.getMap('kept').set('text', 'y'.repeat(SIZE_WARNING_BYTES));
        doc.getMap('kept').delete('text');
        const kept = Yjs.encodeStateAsUpdate(doc);

        expect(kept.byteLength).toBeGreaterThan(2 * SIZE_WARNING_BYTES);
        expect(measureDocument(() => kept, Yjs)).toBeLessThan(
            collaboration.state(document.id).byteLength + 1024
        );
    });

    it('says how large a held-back document is and where it is kept', () => {
        expect(formatSize(3.25 * 1024 * 1024)).toBe('3.3 MB');
        expect(formatSize(MAX_UPLOAD_BYTES)).toBe('4.0 MB');
        expect(formatSize(MAX_MESSAGE + 1)).toBe('4.1 MB');
        expect(tooLargeMessage('Plan', 4.5 * 1024 * 1024)).toBe(
            '“Plan” is 4.5 MB, more than the server takes at once. It is kept only in this browser until it is smaller.'
        );
        expect(tooLargeMessage(undefined, 5 * 1024 * 1024)).toMatch(/^A document is 5\.0 MB/);
    });
});
