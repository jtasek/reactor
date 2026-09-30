/** The database of documents kept signed out; each account has one of its own. */
const NAME = 'reactor';
const VERSION = 1;
const DOCUMENTS = 'documents';
const UPDATES = 'updates';

interface UpdateRecord {
    documentId: string;
    update: Uint8Array;
}

const request = <T>(pending: IDBRequest<T>) =>
    new Promise<T>((resolve, reject) => {
        pending.onsuccess = () => resolve(pending.result);
        pending.onerror = () => reject(pending.error);
    });

const completion = (transaction: IDBTransaction) =>
    new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error ?? new Error('Transaction aborted'));
    });

/**
 * Saved documents in IndexedDB: an index of the documents, and each document's
 * Yjs updates on their own. Open copies of the editor on one device write at the
 * same time, so every change is a record of its own and none overwrites another.
 */
export class DocumentDatabase {
    private constructor(private readonly database: IDBDatabase) {
        // Let a newer build upgrade the database.
        database.onversionchange = () => database.close();
    }

    static async open(factory: IDBFactory = indexedDB, name = NAME): Promise<DocumentDatabase> {
        const opening = factory.open(name, VERSION);

        opening.onupgradeneeded = () => {
            const database = opening.result;

            database.createObjectStore(DOCUMENTS, { keyPath: 'id' });
            database
                .createObjectStore(UPDATES, { autoIncrement: true })
                .createIndex('documentId', 'documentId');
        };

        return new DocumentDatabase(await request(opening));
    }

    /** Ids of the saved documents. */
    async documentIds(): Promise<string[]> {
        const keys = await request(
            this.database.transaction(DOCUMENTS).objectStore(DOCUMENTS).getAllKeys()
        );

        return keys.map(String);
    }

    /** A document's saved updates, oldest first. */
    async load(documentId: string): Promise<Uint8Array[]> {
        const records = await request<UpdateRecord[]>(
            this.database
                .transaction(UPDATES)
                .objectStore(UPDATES)
                .index('documentId')
                .getAll(documentId)
        );

        return records.map(({ update }) => update);
    }

    /** Saves a new document and its starting state. */
    create(documentId: string, state: Uint8Array): Promise<void> {
        const transaction = this.database.transaction([DOCUMENTS, UPDATES], 'readwrite');

        transaction.objectStore(DOCUMENTS).put({ id: documentId });
        transaction.objectStore(UPDATES).add({ documentId, update: state });

        return completion(transaction);
    }

    /** Saves a change to a document, unless another copy deleted the document. */
    append(documentId: string, update: Uint8Array): Promise<void> {
        const transaction = this.database.transaction([DOCUMENTS, UPDATES], 'readwrite');
        const saved = transaction.objectStore(DOCUMENTS).getKey(documentId);

        saved.onsuccess = () => {
            if (saved.result !== undefined) {
                transaction.objectStore(UPDATES).add({ documentId, update });
            }
        };

        return completion(transaction);
    }

    /**
     * Replaces a document's updates with one that merges them. Only the updates read
     * here are replaced, so one another copy saves meanwhile is kept.
     */
    compact(documentId: string, merge: (updates: Uint8Array[]) => Uint8Array): Promise<void> {
        const transaction = this.database.transaction(UPDATES, 'readwrite');
        const updates = transaction.objectStore(UPDATES);
        const keys = updates.index('documentId').getAllKeys(documentId);
        const records = updates.index('documentId').getAll(documentId);

        records.onsuccess = () => {
            const saved: UpdateRecord[] = records.result;

            if (saved.length < 2) {
                return;
            }

            keys.result.forEach((key) => updates.delete(key));
            updates.add({ documentId, update: merge(saved.map(({ update }) => update)) });
        };

        return completion(transaction);
    }

    /** Deletes a document and its updates. */
    remove(documentId: string): Promise<void> {
        const transaction = this.database.transaction([DOCUMENTS, UPDATES], 'readwrite');
        const updates = transaction.objectStore(UPDATES);
        const keys = updates.index('documentId').getAllKeys(documentId);

        transaction.objectStore(DOCUMENTS).delete(documentId);
        keys.onsuccess = () => keys.result.forEach((key) => updates.delete(key));

        return completion(transaction);
    }

    close(): void {
        this.database.close();
    }
}

/** The database of this device, from the browser's IndexedDB. */
export const openDocumentDatabase = (name?: string) => DocumentDatabase.open(indexedDB, name);
