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
    /** The hashes of the images the server keeps for a document. */
    assetHashes(documentId: string): Promise<string[]>;
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
    async assetHashes(documentId) {
        const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}/assets`, {
            credentials: 'same-origin'
        });

        if (!response.ok) {
            throw new Error(`The images of ${documentId} could not be listed: ${response.status}`);
        }

        return (await response.json()) as string[];
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

/** How many images are uploaded or fetched at once. */
const MAX_TRANSFERS = 3;

/** How long changes to a document gather before its images are looked over. */
const SHARE_DELAY_MS = 1000;

/** How long an image the server refused waits before it is offered again, as room may free up. */
const REFUSAL_RETRY_MS = 10 * 60 * 1000;

/** The image hashes a document's shapes show, imported library components' included. */
export const imageHashes = (document: Document | undefined) =>
    new Set(
        [
            ...Object.values(document?.shapes ?? {}),
            ...Object.values(document?.components ?? {}).flatMap((component) =>
                Object.values(component.sourceShapes ?? {})
            )
        ].flatMap((shape) =>
            shape.type === 'image' && shape.source.startsWith(ASSET_PREFIX)
                ? [shape.source.slice(ASSET_PREFIX.length)]
                : []
        )
    );

/** What image sharing reads of the editor, and how it hands the editor its downloads. */
export interface AssetSyncSource {
    /** The server's calls for images; its own over HTTP without. */
    server?: AssetServer;
    document(documentId: string): Document | undefined;
    database(): DocumentDatabase | undefined;
    displayError(message: string): void;
    use(sync: AssetSync): void;
}

/**
 * Shares images with the server once signed in: uploads the ones a document uses
 * that the server lacks for it, and fetches the ones this browser lacks. What the
 * server keeps for a document is asked once a session, as the list of its images.
 */
export function createAssetSync(editor: AssetSyncSource, server = assetApi): AssetSync {
    /** Per document, the images the server keeps or is being given; a list that fails is asked again. */
    const onServer = new Map<string, Promise<Set<string>>>();
    /** When the server last refused an image, by `documentId/hash`. */
    const refused = new Map<string, number>();
    const changed = new Map<string, ReturnType<typeof setTimeout>>();
    const waiting: Array<() => void> = [];
    let running = 0;
    let toldNoRoom = false;

    /** Runs `task` once fewer than `MAX_TRANSFERS` others run; an ending task hands its turn on. */
    const queued = async <T>(task: () => Promise<T>) => {
        if (running < MAX_TRANSFERS) {
            running++;
        } else {
            await new Promise<void>((resolve) => waiting.push(resolve));
        }

        try {
            return await task();
        } finally {
            const next = waiting.shift();

            if (next) {
                next();
            } else {
                running--;
            }
        }
    };
    const kept = (documentId: string) => {
        const known =
            onServer.get(documentId) ??
            server.assetHashes(documentId).then((hashes) => new Set(hashes));

        onServer.set(documentId, known);
        known.catch(() => onServer.delete(documentId));

        return known;
    };

    /**
     * Uploads an image a document uses that the server lacks for it. One kept only
     * by another copy is that copy's to upload; one that fails is tried again with
     * the document's next change or link, and one refused some minutes later.
     */
    const share = async (documentId: string, hash: string, known: Set<string>) => {
        const key = `${documentId}/${hash}`;

        if (known.has(hash) || (refused.get(key) ?? 0) > Date.now() - REFUSAL_RETRY_MS) {
            return;
        }

        known.add(hash);
        await queued(async () => {
            try {
                const asset = await editor.database()?.asset(hash);
                const uploaded = asset && (await server.uploadAsset(documentId, hash, asset));

                if (uploaded && uploaded !== 'kept') {
                    known.delete(hash);
                    refused.set(key, Date.now());
                }

                // Once a session says it; the next images would only repeat it.
                if (uploaded === 'noRoom' && !toldNoRoom) {
                    toldNoRoom = true;
                    editor.displayError(NO_ROOM);
                }
            } catch {
                known.delete(hash);
            }
        });
    };

    return {
        /** Shares a document's images once its changes have gathered for a moment. */
        changed(documentId: string) {
            if (changed.has(documentId)) {
                return;
            }

            changed.set(
                documentId,
                setTimeout(() => {
                    changed.delete(documentId);
                    void kept(documentId).then(
                        (known) =>
                            imageHashes(editor.document(documentId)).forEach(
                                (hash) => void share(documentId, hash, known)
                            ),
                        () => {}
                    );
                }, SHARE_DELAY_MS)
            );
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

                const found = await queued(() =>
                    server.asset(documentId, hash).catch(() => undefined)
                );

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
