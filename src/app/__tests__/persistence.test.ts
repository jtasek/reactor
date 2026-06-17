import { Document } from '../types';
import {
    PersistedState,
    SCHEMA_VERSION,
    migratePersistedState,
    serializePersistedState
} from '../services/persistence';

const makeDocument = (id: string): Document => ({ id }) as Document;

describe('persistence', () => {
    describe('serializePersistedState()', () => {
        it('wraps the documents map and current id in a versioned envelope', () => {
            const documents = { 'document-1': makeDocument('document-1') };

            const actual = serializePersistedState({
                currentDocumentId: 'document-1',
                documents
            });

            expect(actual).toEqual({
                version: SCHEMA_VERSION,
                currentDocumentId: 'document-1',
                documents
            });
        });
    });

    describe('migratePersistedState()', () => {
        const valid: PersistedState = {
            version: SCHEMA_VERSION,
            currentDocumentId: 'document-1',
            documents: { 'document-1': makeDocument('document-1') }
        };

        it('round-trips a freshly serialized state', () => {
            expect(migratePersistedState(serializePersistedState(valid))).toEqual(valid);
        });

        it('returns null for null/undefined/non-objects', () => {
            expect(migratePersistedState(null)).toBeNull();
            expect(migratePersistedState(undefined)).toBeNull();
            expect(migratePersistedState('reactor')).toBeNull();
        });

        it('rejects legacy unversioned blobs (single Document under app key)', () => {
            expect(migratePersistedState(makeDocument('document-1'))).toBeNull();
        });

        it('rejects state from a newer schema version', () => {
            expect(migratePersistedState({ ...valid, version: SCHEMA_VERSION + 1 })).toBeNull();
        });

        it('rejects a malformed documents table', () => {
            expect(
                migratePersistedState({ ...valid, documents: { 'document-1': { foo: 'bar' } } })
            ).toBeNull();
        });

        it('falls back to the first document when currentDocumentId is missing', () => {
            const actual = migratePersistedState({ ...valid, currentDocumentId: 'gone' });

            expect(actual?.currentDocumentId).toBe('document-1');
        });

        it('returns null when there are no documents to fall back to', () => {
            expect(
                migratePersistedState({ ...valid, currentDocumentId: 'gone', documents: {} })
            ).toBeNull();
        });
    });
});
