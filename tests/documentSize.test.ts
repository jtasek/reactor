import * as Yjs from 'yjs';
import { createApplication, createDocument, createShape } from 'src/app/factories';
import { Collaboration } from 'src/app/services/collaboration';
import {
    DEFAULT_DOCUMENT_SIZE,
    formatSize,
    measureDocument,
    sizeLevel,
    tooLargeMessage
} from 'src/app/services/documentSize';
import { MAX_MESSAGE } from '../server/sync';

const { warningBytes, uploadBytes } = DEFAULT_DOCUMENT_SIZE;

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
    it('is configured with the defaults', () => {
        expect(createApplication().config.documentSize).toEqual(DEFAULT_DOCUMENT_SIZE);
        expect(warningBytes).toBe(3 * 1024 * 1024);
    });

    it('warns from the warning size and refuses what is over the upload limit', () => {
        expect(sizeLevel(warningBytes - 1, DEFAULT_DOCUMENT_SIZE)).toBe('fits');
        expect(sizeLevel(warningBytes, DEFAULT_DOCUMENT_SIZE)).toBe('large');
        expect(sizeLevel(uploadBytes, DEFAULT_DOCUMENT_SIZE)).toBe('large');
        expect(sizeLevel(uploadBytes + 1, DEFAULT_DOCUMENT_SIZE)).toBe('tooLarge');
    });

    it('follows configured limits', () => {
        const limits = { warningBytes: 100, uploadBytes: 200 };

        expect(sizeLevel(99, limits)).toBe('fits');
        expect(sizeLevel(150, limits)).toBe('large');
        expect(sizeLevel(201, limits)).toBe('tooLarge');
    });

    it('leaves room in the server’s largest message for the document’s id', () => {
        expect(uploadBytes).toBe(MAX_MESSAGE - 1024);
    });

    it('measures a document’s whole shared state', async () => {
        const { collaboration, document } = await opened('x'.repeat(warningBytes));
        const bytes = measureDocument(() => collaboration.state(document.id), Yjs, warningBytes)!;

        expect(bytes).toBe(collaboration.state(document.id).byteLength);
        expect(sizeLevel(bytes, DEFAULT_DOCUMENT_SIZE)).toBe('large');
    });

    it('measures nothing for a document that is not open', async () => {
        const { collaboration } = await opened('small');

        expect(
            measureDocument(() => collaboration.state('missing'), Yjs, warningBytes)
        ).toBeUndefined();
    });

    it('leaves out deleted content kept for undo, which other copies drop', async () => {
        const { collaboration, document } = await opened('x'.repeat(warningBytes));
        const doc = new Yjs.Doc({ gc: false });

        Yjs.applyUpdate(doc, collaboration.state(document.id));
        doc.getMap('kept').set('text', 'y'.repeat(warningBytes));
        doc.getMap('kept').delete('text');
        const kept = Yjs.encodeStateAsUpdate(doc);

        expect(kept.byteLength).toBeGreaterThan(2 * warningBytes);
        expect(measureDocument(() => kept, Yjs, warningBytes)).toBeLessThan(
            collaboration.state(document.id).byteLength + 1024
        );
        // Below `above`, the encoded size is taken as it is.
        expect(measureDocument(() => kept, Yjs, kept.byteLength)).toBe(kept.byteLength);
    });

    it('says how large a held-back document is and where it is kept', () => {
        expect(formatSize(3.25 * 1024 * 1024)).toBe('3.3 MB');
        expect(formatSize(uploadBytes)).toBe('4.0 MB');
        expect(formatSize(MAX_MESSAGE + 1)).toBe('4.1 MB');
        expect(tooLargeMessage('Plan', 4.5 * 1024 * 1024)).toBe(
            '“Plan” is 4.5 MB, more than the server takes at once. It is kept only in this browser until it is smaller.'
        );
        expect(tooLargeMessage(undefined, 5 * 1024 * 1024)).toMatch(/^A document is 5\.0 MB/);
    });
});
