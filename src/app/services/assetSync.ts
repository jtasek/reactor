import type { Document } from '../types';
import type { Asset, DocumentDatabase } from './documentDatabase';

/** How an image shape's `source` names an asset: `asset:` and the SHA-256 of its bytes. */
const ASSET_PREFIX = 'asset:';

/** An image a document uses: its type and bytes. */
export type AssetBytes = Omit<Asset, 'hash'>;

/** How an upload of an image ended: kept, refused for the workspace's quota, or refused for good. */
export type AssetUpload = 'kept' | 'noRoom' | 'refused';

/** The server's calls for the images of documents. */
export interface AssetServer {
    /** Whether the server keeps an image for a document. */
    hasAsset(documentId: string, hash: string): Promise<boolean>;
    /** Uploads an image for a document; a request that may succeed when sent again throws. */
    uploadAsset(documentId: string, hash: string, asset: AssetBytes): Promise<AssetUpload>;
    /** An image a document uses, or undefined when the server keeps none by that hash for it. */
    asset(documentId: string, hash: string): Promise<AssetBytes | undefined>;
}

/** Answers to an upload that no retry changes: an invalid image, no right to, or a quota. */
const REFUSED = new Set([400, 403, 415]);

const assetPath = (documentId: string, hash: string) =>
    `/api/documents/${encodeURIComponent(documentId)}/assets/${encodeURIComponent(hash)}`;

const send = (method: string, documentId: string, hash: string, bytes?: Uint8Array<ArrayBuffer>) =>
    fetch(assetPath(documentId, hash), {
        method,
        credentials: 'same-origin',
        headers: bytes ? { 'content-type': 'application/octet-stream' } : undefined,
        body: bytes
    });

/** The images of the signed-in user's documents on the server. */
export const assetApi: AssetServer = {
    async hasAsset(documentId, hash) {
        const response = await send('HEAD', documentId, hash);

        if (response.ok || response.status === 404) {
            return response.ok;
        }

        throw new Error(`The image ${hash} could not be looked for: ${response.status}`);
    },
    async uploadAsset(documentId, hash, { bytes }) {
        const response = await send('PUT', documentId, hash, bytes);

        if (response.ok) {
            return 'kept';
        }

        if (response.status === 413) {
            return 'noRoom';
        }

        // A document the server does not have yet throws too, to be uploaded for once it does.
        if (REFUSED.has(response.status)) {
            return 'refused';
        }

        throw new Error(`The image ${hash} could not be uploaded: ${response.status}`);
    },
    async asset(documentId, hash) {
        const response = await send('GET', documentId, hash);

        if (response.status === 404) {
            return undefined;
        }

        if (!response.ok) {
            throw new Error(`The image ${hash} could not be read: ${response.status}`);
        }

        return {
            type: response.headers.get('content-type') ?? '',
            bytes: new Uint8Array(await response.arrayBuffer())
        };
    }
};

const NO_ROOM = 'An image could not be shared: the workspace has no room for more images.';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** How long to wait, in turn, before asking again for an image not uploaded yet. */
const DOWNLOAD_RETRIES_MS = [1000, 3000, 10000];

/** What image sharing reads of the editor, and how it hands the editor its downloads. */
export interface AssetSyncSource {
    document(documentId: string): Document | undefined;
    database(): DocumentDatabase | undefined;
    displayError(message: string): void;
    use(sync: AssetSync): void;
}

/**
 * Shares images with the server once signed in: uploads the ones a document uses
 * that the server lacks for it, and fetches the ones this browser lacks.
 */
export function createAssetSync(editor: AssetSyncSource, server = assetApi): AssetSync {
    /** The images, as `documentId/hash`, the server has or is being given for a document. */
    const shared = new Set<string>();
    const changed = new Set<string>();

    /**
     * Uploads a document's images that the server lacks for it. One kept only by
     * another copy is that copy's to upload; one that fails is tried again with the
     * document's next change or link.
     */
    const share = async (documentId: string, hash: string) => {
        const key = `${documentId}/${hash}`;

        if (shared.has(key)) {
            return;
        }

        shared.add(key);
        try {
            if (await server.hasAsset(documentId, hash)) {
                return;
            }

            const asset = await editor.database()?.asset(hash);

            if (asset && (await server.uploadAsset(documentId, hash, asset)) === 'noRoom') {
                editor.displayError(NO_ROOM);
            }
        } catch {
            shared.delete(key);
        }
    };

    return {
        /** Shares a document's images once the task's changes to it end. */
        changed(documentId: string) {
            if (changed.size === 0) {
                queueMicrotask(() => {
                    changed.forEach((id) =>
                        new Set(
                            Object.values(editor.document(id)?.shapes ?? {}).map((shape) =>
                                shape.type === 'image' ? shape.source : ''
                            )
                        ).forEach(
                            (source) =>
                                source.startsWith(ASSET_PREFIX) &&
                                void share(id, source.slice(ASSET_PREFIX.length))
                        )
                    );
                    changed.clear();
                });
            }
            changed.add(documentId);
        },

        /**
         * An image from the server for a document, kept in `database` too; one another
         * copy has not uploaded yet is asked for again a few times.
         */
        async download(
            documentId: string | undefined,
            hash: string,
            database: DocumentDatabase | undefined
        ) {
            // Without a document, the server has no image to give.
            if (!documentId) {
                return undefined;
            }

            for (const delay of [0, ...DOWNLOAD_RETRIES_MS]) {
                await wait(delay);

                const found = await server.asset(documentId, hash).catch(() => undefined);

                if (found) {
                    await database?.putAsset({ hash, ...found }).catch(() => {});

                    return found;
                }
            }

            return undefined;
        }
    };
}

export interface AssetSync {
    changed(documentId: string): void;
    download(
        documentId: string | undefined,
        hash: string,
        database: DocumentDatabase | undefined
    ): Promise<AssetBytes | undefined>;
}
