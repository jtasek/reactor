import { IDBFactory } from 'fake-indexeddb';
import { DocumentDatabase } from 'src/app/services/documentDatabase';
import { createTestStore } from './support/store';

const created = new Date('2026-10-01T08:00:00Z');
const edited = new Date('2026-10-10T09:00:00Z');
const later = new Date('2026-10-12T10:00:00Z');
const rectangle = {
    type: 'rectangle' as const,
    position: { x: 0, y: 0 },
    size: { width: 20, height: 10 }
};

async function start(indexedDB = new IDBFactory()) {
    const test = createTestStore({}, { indexedDB, autoSave: true });

    await test.store.onInitialize();

    return test;
}

describe('document modification dates', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(created);
    });

    afterEach(() => vi.useRealTimers());

    it('dates content, name and tag edits when they are saved', async () => {
        const { store, effects } = await start();
        const id = store.state.currentDocumentId;

        vi.setSystemTime(edited);
        store.actions.addShape(rectangle);
        effects.collaboration.flush();
        expect(store.state.documents[id].modified).toEqual(edited);

        vi.setSystemTime(later);
        store.actions.updateDocument({ id, name: 'New name' });
        effects.collaboration.flush();
        expect(store.state.documents[id].modified).toEqual(later);

        vi.setSystemTime(new Date('2026-10-13T11:00:00Z'));
        store.actions.updateDocument({ id, tags: ['Design'] });
        effects.collaboration.flush();
        expect(store.state.documents[id].modified).toEqual(new Date());
        expect(store.state.documents[id].created).toEqual(created);
    });

    it('ignores selection, camera, measurements, view state and unchanged metadata', async () => {
        const { store, effects } = await start();

        store.actions.addShape(rectangle);
        store.actions.addLayer({ id: 'layer' });
        effects.collaboration.flush();

        const { id, name, shapesIds } = store.state.currentDocument;

        vi.setSystemTime(edited);
        store.actions.selectDocument(id);
        store.actions.unselectDocument(id);
        store.actions.unselectShapes();
        store.actions.tools.panCamera({ dx: 30, dy: 40 });
        store.actions.setShapeBounds({
            id: shapesIds[0],
            bounds: {
                topLeft: { x: 0, y: 0 },
                bottomRight: { x: 20, y: 10 },
                width: 20,
                height: 10
            }
        });
        store.actions.showOnlyLayer('layer');
        store.actions.updateDocument({ id, name, filter: 'rectangle' });
        effects.collaboration.flush();

        expect(store.state.documents[id].modified).toEqual(created);
    });

    it('dates a completed drag but leaves a canceled drag unchanged', async () => {
        const { store, effects } = await start();
        const { events } = store.actions;

        store.actions.addShape(rectangle);
        effects.collaboration.flush();

        vi.setSystemTime(edited);
        events.beginGesture({ pointerId: 1, position: { x: 5, y: 5 } });
        events.movePointer({ pointerId: 1, position: { x: 15, y: 5 } });
        effects.collaboration.flush();
        expect(store.state.currentDocument.modified).toEqual(created);
        events.cancelGesture();
        effects.collaboration.flush();
        expect(store.state.currentDocument.modified).toEqual(created);

        events.beginGesture({ pointerId: 1, position: { x: 5, y: 5 } });
        events.endGesture({ pointerId: 1, position: { x: 15, y: 5 } });
        effects.collaboration.flush();
        expect(store.state.currentDocument.modified).toEqual(edited);
    });

    it('preserves the saved date when loading and receiving another copy’s edit', async () => {
        const indexedDB = new IDBFactory();
        const first = await start(indexedDB);

        vi.setSystemTime(edited);
        first.store.actions.addShape(rectangle);
        first.effects.collaboration.flush();

        vi.setSystemTime(later);
        const restored = await start(indexedDB);
        const id = first.store.state.currentDocumentId;

        expect(restored.store.state.currentDocument.modified).toEqual(edited);

        first.store.actions.updateDocument({ id, name: 'Shared name' });
        first.effects.collaboration.flush();
        const update = first.effects.collaboration.state(id);

        vi.setSystemTime(new Date('2026-10-13T11:00:00Z'));
        restored.effects.collaboration.receive(id, update);
        restored.effects.collaboration.flush();

        expect(restored.store.state.documents[id].name).toBe('Shared name');
        expect(restored.store.state.documents[id].modified).toEqual(later);
    });

    it('keeps the date when a canceled drag receives an already-known update', async () => {
        const { store, effects } = await start();
        const { events } = store.actions;

        store.actions.addShape(rectangle);
        effects.collaboration.flush();
        const { id, shapesIds } = store.state.currentDocument;
        const update = effects.collaboration.state(id);

        vi.setSystemTime(edited);
        events.beginGesture({ pointerId: 1, position: { x: 5, y: 5 } });
        events.movePointer({ pointerId: 1, position: { x: 15, y: 5 } });
        effects.collaboration.receive(id, update);
        expect(store.state.currentDocument.modified).toEqual(created);

        vi.setSystemTime(later);
        events.cancelGesture();
        effects.collaboration.flush();

        expect(store.state.currentDocument.shapes[shapesIds[0]]).toMatchObject({
            position: rectangle.position
        });
        expect(store.state.currentDocument.modified).toEqual(created);
    });

    it.each(['cancel', 'commit'] as const)(
        'keeps a remote edit and its date until a concurrent drag ends with %s',
        async (ending) => {
            const indexedDB = new IDBFactory();
            const first = await start(indexedDB);

            first.store.actions.addShape(rectangle);
            first.effects.collaboration.flush();
            const second = await start(indexedDB);
            const { id, shapesIds } = first.store.state.currentDocument;
            const { events } = first.store.actions;

            events.beginGesture({ pointerId: 1, position: { x: 5, y: 5 } });
            events.movePointer({ pointerId: 1, position: { x: 15, y: 5 } });

            vi.setSystemTime(edited);
            second.store.actions.updateShape({ id: shapesIds[0], name: 'Remote name' });
            second.effects.collaboration.flush();
            const update = second.effects.collaboration.state(id);

            vi.setSystemTime(later);
            first.effects.collaboration.receive(id, update);
            expect(first.store.state.currentDocument.modified).toEqual(edited);

            if (ending === 'cancel') {
                events.cancelGesture();
            } else {
                events.endGesture({ pointerId: 1, position: { x: 15, y: 5 } });
            }
            first.effects.collaboration.flush();

            expect(first.store.state.currentDocument.shapes[shapesIds[0]]).toMatchObject({
                name: 'Remote name',
                position: { x: ending === 'cancel' ? 0 : 10, y: 0 }
            });
            const modified = ending === 'cancel' ? edited : later;

            expect(first.store.state.currentDocument.modified).toEqual(modified);
            second.effects.collaboration.receive(id, first.effects.collaboration.state(id));
            expect(second.store.state.currentDocument.modified).toEqual(modified);
        }
    );

    it.each([false, true])(
        'dates unrelated local edits when canceling a drag, with an intervening update: %s',
        async (receiveUpdate) => {
            const { store, effects } = await start();

            store.actions.addShape(rectangle);
            store.actions.addShape({ ...rectangle, position: { x: 100, y: 0 } });
            effects.collaboration.flush();
            const { id, shapesIds } = store.state.currentDocument;
            const update = effects.collaboration.state(id);
            const { events } = store.actions;

            store.actions.unselectShapes();
            events.beginGesture({ pointerId: 1, position: { x: 5, y: 5 } });
            events.movePointer({ pointerId: 1, position: { x: 15, y: 5 } });
            store.actions.updateShape({ id: shapesIds[1], name: 'Other shape edited' });
            store.actions.updateDocument({ id, tags: ['Design'] });

            if (receiveUpdate) {
                effects.collaboration.receive(id, update);
            }

            vi.setSystemTime(edited);
            events.cancelGesture();
            effects.collaboration.flush();

            expect(store.state.currentDocument.shapes[shapesIds[0]]).toMatchObject({
                position: rectangle.position
            });
            expect(store.state.currentDocument.shapes[shapesIds[1]].name).toBe(
                'Other shape edited'
            );
            expect(store.state.currentDocument.tags).toEqual(['Design']);
            expect(store.state.currentDocument.modified).toEqual(edited);
        }
    );

    it('dates a reset in the same saved update without writing a later date', async () => {
        const indexedDB = new IDBFactory();
        const { store, effects } = await start(indexedDB);

        store.actions.addShape(rectangle);
        effects.collaboration.flush();
        const database = await DocumentDatabase.open(indexedDB);
        const id = store.state.currentDocumentId;
        const before = (await database.load(id)).length;

        vi.setSystemTime(edited);
        store.actions.requestDocumentReset();
        store.actions.resetDocument();
        effects.collaboration.flush();
        expect(store.state.currentDocument.modified).toEqual(edited);
        expect((await database.load(id)).length).toBe(before + 1);

        vi.setSystemTime(later);
        effects.collaboration.flush();
        expect(store.state.currentDocument.modified).toEqual(edited);
        expect((await database.load(id)).length).toBe(before + 1);
        database.close();
    });

    it('saves and shares a tag tone without dating the documents that have the tag', async () => {
        const indexedDB = new IDBFactory();
        const first = await start(indexedDB);
        const id = first.store.state.currentDocumentId;

        first.store.actions.updateDocument({ id, tags: ['Design'] });
        first.effects.collaboration.flush();

        vi.setSystemTime(later);
        first.store.actions.setTagTone({ tag: ' design ', tone: 'purple' });
        first.effects.collaboration.flush();

        expect(first.store.state.documents[id].tagTones).toEqual({ design: 'purple' });
        expect(first.store.state.documents[id].modified).toEqual(created);

        const second = await start(indexedDB);

        expect(second.store.state.documents[id].tagTones).toEqual({ design: 'purple' });
        expect(second.store.state.documents[id].modified).toEqual(created);
    });

    it('gives a clone fresh dates and preserves its source dates', async () => {
        const { store, effects } = await start();
        const sourceId = store.state.currentDocumentId;

        vi.setSystemTime(edited);
        store.actions.cloneDocument(sourceId);
        await Promise.resolve();
        effects.collaboration.flush();

        const cloneId = store.state.documentsIds.find((id) => id !== sourceId)!;

        expect(store.state.documents[cloneId]).toMatchObject({
            created: edited,
            modified: edited
        });
        expect(store.state.documents[sourceId]).toMatchObject({
            created,
            modified: created
        });
    });
});
