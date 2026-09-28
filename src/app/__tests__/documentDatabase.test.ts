import { IDBFactory } from 'fake-indexeddb';
import { DocumentDatabase } from '../services/documentDatabase';

const bytes = (...values: number[]) => new Uint8Array(values);
const join = (updates: Uint8Array[]) => bytes(...updates.flatMap((update) => [...update]));

describe('document database', () => {
    let factory: IDBFactory;

    beforeEach(() => {
        factory = new IDBFactory();
    });

    it('saves a document and loads its updates in order', async () => {
        const database = await DocumentDatabase.open(factory);

        await database.create('d', bytes(0));
        await database.append('d', bytes(1));
        await database.append('d', bytes(2));

        expect(await database.documentIds()).toEqual(['d']);
        expect(await database.load('d')).toEqual([bytes(0), bytes(1), bytes(2)]);
        expect(await database.load('other')).toEqual([]);
    });

    it('keeps the changes two open copies save at once', async () => {
        const [first, second] = await Promise.all([
            DocumentDatabase.open(factory),
            DocumentDatabase.open(factory)
        ]);

        await first.create('d', bytes(0));
        await Promise.all([first.append('d', bytes(1)), second.append('d', bytes(2))]);

        expect(await second.load('d')).toEqual([bytes(0), bytes(1), bytes(2)]);
    });

    it('drops a change to a document another copy deleted', async () => {
        const [first, second] = await Promise.all([
            DocumentDatabase.open(factory),
            DocumentDatabase.open(factory)
        ]);

        await first.create('d', bytes(0));
        await second.remove('d');
        await first.append('d', bytes(1));

        expect(await first.documentIds()).toEqual([]);
        expect(await first.load('d')).toEqual([]);
    });

    it('merges updates into one, keeping one another copy saves meanwhile', async () => {
        const [first, second] = await Promise.all([
            DocumentDatabase.open(factory),
            DocumentDatabase.open(factory)
        ]);
        const merge = vi.fn(join);

        await first.create('d', bytes(0));
        await first.append('d', bytes(1));
        await Promise.all([first.compact('d', merge), second.append('d', bytes(2))]);

        expect(merge).toHaveBeenCalledExactlyOnceWith([bytes(0), bytes(1)]);
        expect(await first.load('d')).toEqual([bytes(0, 1), bytes(2)]);
    });

    it('leaves a document with one update as it is', async () => {
        const database = await DocumentDatabase.open(factory);
        const merge = vi.fn(join);

        await database.create('d', bytes(0));
        await database.compact('d', merge);

        expect(merge).not.toHaveBeenCalled();
        expect(await database.load('d')).toEqual([bytes(0)]);
    });

    it('keeps the saved updates when merging fails', async () => {
        const database = await DocumentDatabase.open(factory);

        await database.create('d', bytes(0));
        await database.append('d', bytes(1));
        await expect(
            database.compact('d', () => {
                throw new Error('unreadable update');
            })
        ).rejects.toThrow();

        expect(await database.load('d')).toEqual([bytes(0), bytes(1)]);
    });

    it('lets a newer build upgrade the database', async () => {
        await DocumentDatabase.open(factory);

        const upgrade = factory.open('reactor', 2);

        await expect(
            new Promise((resolve, reject) => {
                upgrade.onsuccess = resolve;
                upgrade.onblocked = () => reject(new Error('blocked'));
            })
        ).resolves.toBeDefined();
    });
});
