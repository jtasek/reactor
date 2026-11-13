import * as Y from 'yjs';
import { isReadOnly } from 'src/app/documentAccess';
import { SCHEMA_VERSION } from 'src/app/services/documentStorage';
import {
    DOCUMENT_ID,
    createCopies,
    deliver,
    edit,
    settle,
    shownDocument,
    type Copy
} from './support/collaboration';

const rectangle = (x = 0) => ({
    type: 'rectangle' as const,
    position: { x, y: 0 },
    size: { width: 20, height: 10 }
});

const editableFrom = (copy: Copy) => {
    const doc = new Y.Doc();

    Y.applyUpdate(doc, copy.collaboration.state(DOCUMENT_ID));

    return Math.max(...[...doc.getMap('versions').keys()].map(Number));
};

const names = (copy: Copy) =>
    Object.values(shownDocument(copy).shapes)
        .map(({ name }) => name)
        .sort();

/** An older and a newer editor sharing one document, which the older one started. */
const olderAndNewer = () =>
    createCopies(2, (store) => store.actions.addShape({ ...rectangle(), name: 'first' }), 0, [
        SCHEMA_VERSION - 1,
        SCHEMA_VERSION
    ]);

describe('version check on sync', () => {
    it('records the newest format of the editors that wrote, never lowering it', async () => {
        const [older, newer] = await olderAndNewer();

        expect(editableFrom(older)).toBe(SCHEMA_VERSION - 1);

        edit(newer, (actions) => actions.addShape({ ...rectangle(40), name: 'second' }));
        expect(editableFrom(newer)).toBe(SCHEMA_VERSION);

        settle([older, newer]);
        edit(newer, (actions) => actions.addShape({ ...rectangle(80), name: 'third' }));
        expect(editableFrom(newer)).toBe(SCHEMA_VERSION);
    });

    it('lets an older copy edit until a newer one writes, then only show the document', async () => {
        const [older, newer] = await olderAndNewer();

        edit(older, (actions) => actions.addShape({ ...rectangle(40), name: 'older edit' }));
        settle([older, newer]);
        expect(names(newer)).toEqual(['first', 'older edit']);
        expect(older.store.state.outdatedDocuments).toEqual({});

        edit(newer, (actions) => actions.addShape({ ...rectangle(80), name: 'newer edit' }));
        deliver(older);

        // The older copy shows the newer copy's change, and knows it may not edit.
        expect(names(older)).toEqual(['first', 'newer edit', 'older edit']);
        expect(older.store.state.outdatedDocuments).toEqual({ [DOCUMENT_ID]: SCHEMA_VERSION });
        expect(isReadOnly(older.store.state, DOCUMENT_ID)).toBe(true);
        expect(isReadOnly(newer.store.state, DOCUMENT_ID)).toBe(false);

        // Whatever still reaches its store is neither shared nor undone into the document.
        const before = older.collaboration.state(DOCUMENT_ID);
        edit(older, (actions) => actions.addShape({ ...rectangle(120), name: 'lost' }));
        older.collaboration.undo(DOCUMENT_ID);
        settle([older, newer]);

        expect(newer.inbox).toEqual([]);
        expect(names(newer)).toEqual(['first', 'newer edit', 'older edit']);
        expect(older.collaboration.state(DOCUMENT_ID)).toEqual(before);
    });

    it('keeps the newer format when an older copy writes at the same time', async () => {
        const [older, newer] = await olderAndNewer();

        // Neither has seen the other's change when both are delivered.
        edit(newer, (actions) => actions.addShape({ ...rectangle(40), name: 'newer edit' }));
        edit(older, (actions) => actions.addShape({ ...rectangle(80), name: 'older edit' }));
        settle([older, newer]);

        expect(editableFrom(older)).toBe(SCHEMA_VERSION);
        expect(editableFrom(newer)).toBe(SCHEMA_VERSION);
        expect(older.store.state.outdatedDocuments).toEqual({ [DOCUMENT_ID]: SCHEMA_VERSION });
        expect(newer.store.state.outdatedDocuments).toEqual({});
    });

    it('ignores keys that are not formats', async () => {
        const [older] = await olderAndNewer();
        const doc = new Y.Doc();

        doc.getMap('versions').set('later', true);
        older.collaboration.receive(DOCUMENT_ID, Y.encodeStateAsUpdate(doc));

        expect(older.store.state.outdatedDocuments).toEqual({});
    });

    it('opens a document a newer copy saved as read-only at once', async () => {
        const [newer, older] = await createCopies(
            2,
            (store) => store.actions.addShape({ ...rectangle(), name: 'first' }),
            0,
            [SCHEMA_VERSION, SCHEMA_VERSION - 1]
        );

        expect(older.store.state.outdatedDocuments).toEqual({ [DOCUMENT_ID]: SCHEMA_VERSION });
        expect(names(older)).toEqual(['first']);

        edit(newer, (actions) => actions.addShape({ ...rectangle(40), name: 'still editing' }));
        deliver(older);
        expect(newer.store.state.outdatedDocuments).toEqual({});
        expect(names(older)).toEqual(['first', 'still editing']);
    });
});
