import { createComponent } from 'src/app/factories';
import { componentLibraries } from 'src/app/computed/componentPanels';
import { daysLeftInRecentlyDeleted, RECENTLY_DELETED_DAYS } from 'src/app/documentList';
import {
    migratePersistedState,
    restoreDocuments,
    serializePersistedState
} from 'src/app/services/documentStorage';
import { DOCUMENT_ID, createCopies, edit, settle, shownDocument } from './support/collaboration';
import { createTestStore } from './support/store';

const DAY_MS = 24 * 60 * 60 * 1000;

afterEach(() => vi.useRealTimers());

describe('Recently Deleted', () => {
    it('keeps a deleted document until it is restored, opening another meanwhile', () => {
        const { store } = createTestStore();
        const deletedId = store.state.currentDocumentId;

        store.actions.addDocument({ id: 'other' });
        store.actions.trashDocument(deletedId);

        expect(store.state.documents[deletedId].deleted).toBeInstanceOf(Date);
        expect(store.state.currentDocumentId).toBe('other');

        store.actions.restoreDocument(deletedId);

        expect(store.state.documents[deletedId].deleted).toBeUndefined();
    });

    it('opens a new document when the last one outside it is deleted', () => {
        const { store } = createTestStore();
        const deletedId = store.state.currentDocumentId;

        store.actions.trashDocument(deletedId);

        expect(store.state.documentsIds).toHaveLength(2);
        expect(store.state.currentDocumentId).not.toBe(deletedId);
        expect(store.state.currentDocument.deleted).toBeUndefined();
    });

    it('opens a document outside it when the open one is deleted for good', () => {
        const { store } = createTestStore();
        const openId = store.state.currentDocumentId;

        store.actions.addDocument({ id: 'deleted', deleted: new Date() });
        store.actions.addDocument({ id: 'kept' });
        store.actions.removeDocument(openId);

        expect(store.state.currentDocumentId).toBe('kept');
    });

    it(`deletes documents for good ${RECENTLY_DELETED_DAYS} days after they were deleted`, () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 9, 17, 12));
        const { store } = createTestStore();
        const day = (days: number) => new Date(Date.now() - days * DAY_MS);

        store.actions.addDocument({ id: 'expired', deleted: day(RECENTLY_DELETED_DAYS) });
        store.actions.addDocument({ id: 'recent', deleted: day(RECENTLY_DELETED_DAYS - 1) });
        store.actions.purgeDeletedDocuments();

        expect(store.state.documents.expired).toBeUndefined();
        expect(store.state.documents.recent.deleted).toBeInstanceOf(Date);
        expect(daysLeftInRecentlyDeleted(day(RECENTLY_DELETED_DAYS - 1), new Date())).toBe(1);
        expect(daysLeftInRecentlyDeleted(day(0.5), new Date())).toBe(RECENTLY_DELETED_DAYS);
    });

    it('is saved with the document, and a clone starts outside it', () => {
        const { store } = createTestStore();
        const deletedId = store.state.currentDocumentId;
        const deleted = new Date(2026, 9, 1);

        store.actions.addDocument({ id: 'other' });
        store.actions.updateDocument({ id: deletedId, deleted });

        const saved = migratePersistedState(
            JSON.parse(JSON.stringify(serializePersistedState(store.state)))
        );
        const documents = restoreDocuments(saved!);

        expect(documents[deletedId].deleted).toEqual(deleted);
        expect(documents.other.deleted).toBeUndefined();

        store.actions.cloneDocument(deletedId);

        const copyId = store.state.documentsIds.find((id) => ![deletedId, 'other'].includes(id))!;

        expect(store.state.documents[copyId].deleted).toBeUndefined();
    });

    it('keeps its components out of the libraries other documents import from', () => {
        const { store } = createTestStore();
        const component = createComponent({ id: 'card', name: 'Card' });

        store.actions.addDocument({ id: 'library', components: { card: component } });

        expect(componentLibraries(store.state).map(({ documentId }) => documentId)).toEqual([
            'library'
        ]);

        store.actions.trashDocument('library');

        expect(componentLibraries(store.state)).toEqual([]);
    });

    it('is shared with the other copies', async () => {
        const copies = await createCopies(2);
        const [a, b] = copies;

        edit(a, (actions) => actions.trashDocument(DOCUMENT_ID));
        settle(copies);

        expect(shownDocument(b).deleted).toEqual(shownDocument(a).deleted);

        edit(b, (actions) => actions.restoreDocument(DOCUMENT_ID));
        settle(copies);

        expect(shownDocument(a).deleted).toBeUndefined();
    });
});
