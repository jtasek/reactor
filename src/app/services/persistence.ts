import { Application, Document, HashTable } from '../types';

export const PERSISTENCE_KEY = 'reactor';
export const SCHEMA_VERSION = 1;

export interface PersistedState {
    version: number;
    currentDocumentId: string;
    documents: HashTable<Document>;
}

export function serializePersistedState(
    state: Pick<Application, 'currentDocumentId' | 'documents'>
): PersistedState {
    return {
        version: SCHEMA_VERSION,
        currentDocumentId: state.currentDocumentId,
        documents: state.documents
    };
}

export function migratePersistedState(raw: unknown): PersistedState | null {
    if (!raw || typeof raw !== 'object') {
        return null;
    }

    const candidate = raw as Partial<PersistedState>;

    if (typeof candidate.version !== 'number' || candidate.version > SCHEMA_VERSION) {
        return null;
    }

    if (!isDocumentTable(candidate.documents) || typeof candidate.currentDocumentId !== 'string') {
        return null;
    }

    const documents = candidate.documents;
    const currentDocumentId = documents[candidate.currentDocumentId]
        ? candidate.currentDocumentId
        : Object.keys(documents)[0];

    if (!currentDocumentId) {
        return null;
    }

    return { version: SCHEMA_VERSION, currentDocumentId, documents };
}

function isDocumentTable(value: unknown): value is HashTable<Document> {
    if (!value || typeof value !== 'object') {
        return false;
    }

    return Object.values(value as Record<string, unknown>).every(
        (doc) => !!doc && typeof doc === 'object' && typeof (doc as Document).id === 'string'
    );
}
