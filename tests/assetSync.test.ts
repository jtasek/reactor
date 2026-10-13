import { createAssetSync, imageHashes, type AssetServer } from 'src/app/services/assetSync';
import type { DocumentDatabase } from 'src/app/services/documentDatabase';
import type { Document } from 'src/app/types';

const image = (id: string, hash: string) => ({ id, type: 'image', source: `asset:${hash}` });

/** A document holding image shapes by hash, as much of one as image sharing reads. */
const documentWith = (hashes: string[], libraryHashes: string[] = []) =>
    ({
        shapes: Object.fromEntries(
            hashes.map((hash, index) => [`s${index}`, image(`s${index}`, hash)])
        ),
        components: {
            library: {
                sourceShapes: Object.fromEntries(
                    libraryHashes.map((hash, index) => [`l${index}`, image(`l${index}`, hash)])
                )
            }
        }
    }) as unknown as Document;

const database = {
    asset: async (hash: string) => ({ hash, type: 'image/png', bytes: new Uint8Array([1]) })
} as unknown as DocumentDatabase;

describe('image sharing', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('finds the images of shapes and of imported library components', () => {
        expect([...imageHashes(documentWith(['a', 'b', 'a'], ['c']))]).toEqual(['a', 'b', 'c']);
    });

    it('lists a document’s images once, uploads what is missing three at a time', async () => {
        let running = 0;
        let most = 0;
        const server: AssetServer = {
            assetHashes: vi.fn(async () => ['a']),
            uploadAsset: vi.fn(async () => {
                running++;
                most = Math.max(most, running);
                await new Promise((resolve) => setTimeout(resolve, 10));
                running--;

                return 'kept' as const;
            }),
            asset: async () => undefined
        };
        const sync = createAssetSync(
            {
                document: () => documentWith(['a', 'b', 'c', 'd', 'e', 'f', 'g']),
                database: () => database,
                displayError: () => {},
                use: () => {}
            },
            server
        );

        sync.changed('doc');
        await vi.advanceTimersByTimeAsync(1000);
        await vi.advanceTimersByTimeAsync(100);
        sync.changed('doc');
        await vi.advanceTimersByTimeAsync(1100);

        expect(server.assetHashes).toHaveBeenCalledTimes(1);
        expect(server.uploadAsset).toHaveBeenCalledTimes(6);
        expect(most).toBe(3);
    });

    it('offers an image the server refused again only some minutes later', async () => {
        const server: AssetServer = {
            assetHashes: async () => [],
            uploadAsset: vi.fn(async () => 'refused' as const),
            asset: async () => undefined
        };
        const sync = createAssetSync(
            {
                document: () => documentWith(['a']),
                database: () => database,
                displayError: () => {},
                use: () => {}
            },
            server
        );

        sync.changed('doc');
        await vi.advanceTimersByTimeAsync(1100);
        sync.changed('doc');
        await vi.advanceTimersByTimeAsync(1100);
        expect(server.uploadAsset).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
        sync.changed('doc');
        await vi.advanceTimersByTimeAsync(1100);
        expect(server.uploadAsset).toHaveBeenCalledTimes(2);
    });
});
