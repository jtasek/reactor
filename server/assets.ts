import { createHash } from 'node:crypto';
import type { Db } from './schema.ts';

/** The largest image taken, in bytes. */
export const MAX_ASSET_BYTES = 5 * 1024 * 1024;

/** The bytes of images a workspace's documents may use together. */
export const WORKSPACE_ASSET_BYTES = 500 * 1024 * 1024;

const HASH = /^[0-9a-f]{64}$/;

/** Whether `value` names an asset: the SHA-256 of its bytes, in hex. */
export const isAssetHash = (value: unknown): value is string =>
    typeof value === 'string' && HASH.test(value);

export const assetHash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
    signature.every((byte, index) => bytes[offset + index] === byte);

const codes = (text: string) => [...text].map((character) => character.charCodeAt(0));

/** The image type the bytes begin as. SVG is not one: opened directly, it could run script. */
export function imageType(bytes: Uint8Array): string | null {
    if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
        return 'image/png';
    }

    if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
        return 'image/jpeg';
    }

    if (startsWith(bytes, codes('GIF87a')) || startsWith(bytes, codes('GIF89a'))) {
        return 'image/gif';
    }

    if (startsWith(bytes, codes('RIFF')) && startsWith(bytes, codes('WEBP'), 8)) {
        return 'image/webp';
    }

    return null;
}

/** Where the bytes of assets are kept, each once under its hash. */
export interface BlobStorage {
    put(hash: string, bytes: Uint8Array): Promise<void>;
    get(hash: string): Promise<Uint8Array | undefined>;
}

export const postgresBlobs = (db: Db): BlobStorage => ({
    async put(hash, bytes) {
        await db
            .insertInto('asset_blobs')
            .values({ hash, bytes: Buffer.from(bytes) })
            .onConflict((conflict) => conflict.column('hash').doNothing())
            .execute();
    },

    async get(hash) {
        const found = await db
            .selectFrom('asset_blobs')
            .select('bytes')
            .where('hash', '=', hash)
            .executeTakeFirst();

        return found?.bytes;
    }
});

export type AddedAsset = 'added' | 'alreadyThere' | 'overQuota' | 'noDocument';

interface AssetToAdd {
    documentId: string;
    hash: string;
    type: string;
    bytes: Uint8Array;
    quota: number;
}

/**
 * Whether a document may take an image: `room` when it may. The document and its
 * workspace stay locked for the transaction, so uploads to a workspace are counted
 * one after another and the document is not deleted meanwhile.
 */
async function roomForAsset(
    trx: Db,
    { documentId, hash, bytes, quota }: AssetToAdd
): Promise<'room' | Exclude<AddedAsset, 'added'>> {
    const workspace = await trx
        .selectFrom('workspaces')
        .innerJoin('documents', 'documents.workspace_id', 'workspaces.id')
        .select('workspaces.id')
        .where('documents.id', '=', documentId)
        .forUpdate()
        .executeTakeFirst();

    if (!workspace) {
        return 'noDocument';
    }

    const used = await trx
        .selectFrom('assets')
        .select(['hash', 'size'])
        .where('hash', 'in', (select) =>
            select
                .selectFrom('document_assets')
                .innerJoin('documents', 'documents.id', 'document_assets.document_id')
                .select('document_assets.hash')
                .where('documents.workspace_id', '=', workspace.id)
        )
        .execute();

    // An image the workspace uses already is counted, whichever document takes it next.
    if (used.some((asset) => asset.hash === hash)) {
        const linked = await trx
            .selectFrom('document_assets')
            .select('hash')
            .where('document_id', '=', documentId)
            .where('hash', '=', hash)
            .executeTakeFirst();

        return linked ? 'alreadyThere' : 'room';
    }

    const usedBytes = used.reduce((sum, asset) => sum + asset.size, 0);

    return usedBytes + bytes.length > quota ? 'overQuota' : 'room';
}

/**
 * Keeps an image for a document, unless its workspace's documents would then use
 * more than `quota` bytes of images, each counted once.
 */
export async function addDocumentAsset(
    db: Db,
    blobs: BlobStorage,
    asset: AssetToAdd
): Promise<AddedAsset> {
    const { documentId, hash, type, bytes } = asset;
    // Checked before the bytes are kept, so an upload refused keeps none.
    const before = await db.transaction().execute((trx) => roomForAsset(trx, asset));

    if (before !== 'room') {
        return before;
    }

    await blobs.put(hash, bytes);

    return db.transaction().execute(async (trx) => {
        // Checked again: another upload may have taken the room meanwhile.
        const room = await roomForAsset(trx, asset);

        if (room !== 'room') {
            return room;
        }

        await trx
            .insertInto('assets')
            .values({ hash, type, size: bytes.length })
            .onConflict((conflict) => conflict.column('hash').doNothing())
            .execute();
        await trx.insertInto('document_assets').values({ document_id: documentId, hash }).execute();

        return 'added';
    });
}

/** An image a document uses, or undefined when it uses none by that hash. */
export async function documentAsset(db: Db, blobs: BlobStorage, documentId: string, hash: string) {
    const asset = await db
        .selectFrom('document_assets')
        .innerJoin('assets', 'assets.hash', 'document_assets.hash')
        .select('assets.type')
        .where('document_assets.document_id', '=', documentId)
        .where('document_assets.hash', '=', hash)
        .executeTakeFirst();
    const bytes = asset && (await blobs.get(hash));

    return bytes && { type: asset.type, bytes };
}
