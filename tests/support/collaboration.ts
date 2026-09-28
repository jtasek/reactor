import * as Y from 'yjs';
import { inDrawingOrder } from 'src/app/drawOrder';
import { Collaboration } from 'src/app/services/collaboration';
import { COLLECTIONS, readDocumentFields, readEntity } from 'src/app/services/documentStorage';
import { createTestStore } from './store';

export const DOCUMENT_ID = 'test-document';

type TestStore = ReturnType<typeof createTestStore>['store'];

export interface Copy {
    store: TestStore;
    collaboration: Collaboration;
    /** Updates other copies sent, waiting until the test delivers them. */
    inbox: Uint8Array[];
}

/**
 * Copies of one document, each with its own store and collaboration effect. The
 * first copy's document, after `setup`, is where every copy starts.
 */
export async function createCopies(count: number, setup: (store: TestStore) => void = () => {}) {
    const copies: Copy[] = [];

    for (let index = 0; index < count; index++) {
        const collaboration = new Collaboration();
        const { store } = createTestStore({}, { collaboration });
        const copy: Copy = { store, collaboration, inbox: [] };

        await copy.collaboration.initialize({
            getDocument: (documentId) => store.state.documents[documentId],
            applyRemoteChanges: store.actions.applyRemoteChanges,
            addMutationListener: store.addMutationListener,
            sendUpdate: (_, update) =>
                copies.filter((other) => other !== copy).forEach(({ inbox }) => inbox.push(update))
        });
        copies.push(copy);
    }

    const [first, ...others] = copies;

    setup(first.store);
    first.collaboration.open(DOCUMENT_ID);

    const state = first.collaboration.state(DOCUMENT_ID);

    others.forEach(({ collaboration }) => collaboration.open(DOCUMENT_ID, state));
    copies.forEach(({ inbox }) => inbox.splice(0));

    return copies;
}

export const documentOf = ({ store }: Copy) => store.state.documents[DOCUMENT_ID];

/** Runs `change` in a copy and shares it, as the end of an action does. */
export function edit(copy: Copy, change: (actions: TestStore['actions']) => void) {
    change(copy.store.actions);
    copy.collaboration.flush();
}

/** Delivers a copy's waiting updates, or the first `count` of them. */
export function deliver(copy: Copy, count = copy.inbox.length) {
    copy.inbox
        .splice(0, count)
        .forEach((update) => copy.collaboration.receive(DOCUMENT_ID, update));
}

/** Shares every pending change and delivers every update, until nothing is left to send. */
export function settle(copies: Copy[]) {
    copies.forEach(({ collaboration }) => collaboration.flush());

    while (copies.some(({ inbox }) => inbox.length > 0)) {
        copies.forEach((copy) => deliver(copy));
        copies.forEach(({ collaboration }) => collaboration.flush());
    }
}

/**
 * What a copy's store holds of the shared document, in durable form and without
 * the repairs saving makes, and its draw order.
 */
export function sharedContent(copy: Copy) {
    const document = documentOf(copy);

    return {
        fields: readDocumentFields(document),
        shapesIds: [...document.shapesIds],
        ...Object.fromEntries(
            COLLECTIONS.map((collection) => [
                collection,
                Object.fromEntries(
                    Object.entries(document[collection]).map(([id, entity]) => [
                        id,
                        readEntity(collection, entity)
                    ])
                )
            ])
        )
    };
}

/** A copy's Yjs document, as plain data. */
export function sharedState(copy: Copy) {
    const doc = new Y.Doc();

    Y.applyUpdate(doc, copy.collaboration.state(DOCUMENT_ID));

    return Object.fromEntries(
        ['document', ...COLLECTIONS].map((name) => [name, doc.getMap(name).toJSON()])
    );
}

/**
 * Checks that a copy's store has a correct draw order, members listed once and no
 * references to missing shapes or components.
 */
export function expectConsistent(copy: Copy) {
    const document = documentOf(copy);
    const exists = (id: string | undefined) => id === undefined || id in document.shapes;
    const lists = [document.groups, document.layers, document.components].flatMap((table) =>
        Object.values(table).map(({ shapesIds }) => shapesIds)
    );

    expect(document.shapesIds).toEqual(inDrawingOrder(document.shapes));
    expect(lists.every((list) => new Set(list).size === list.length)).toBe(true);
    expect(lists.flat().every(exists)).toBe(true);
    expect(
        Object.values(document.links).every(
            ({ source, target }) => exists(source) && exists(target)
        )
    ).toBe(true);
    expect(Object.values(document.shapes).every(({ parentShapeId }) => exists(parentShapeId))).toBe(
        true
    );
    expect(
        Object.values(document.components).every(
            ({ parentId }) => parentId === undefined || parentId in document.components
        )
    ).toBe(true);
}

/** A repeatable random number generator (mulberry32). */
export function seeded(seed: number) {
    let state = seed;

    return () => {
        state = (state + 0x6d2b79f5) | 0;

        let value = Math.imul(state ^ (state >>> 15), 1 | state);

        value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;

        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}
