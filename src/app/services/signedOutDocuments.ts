import * as Y from 'yjs';
import type { Context } from 'src/app';
import type { Document } from '../types';
import { snapshotDocument } from './documentHistory';
import { COLLECTIONS, PERSISTENCE_KEY } from './documentStorage';
import { accountCopy } from './documentSync';

/**
 * The most a document's state may weigh to move into an account. The server takes
 * messages of at most 4 MiB (`MAX_MESSAGE` in server/sync.ts), and a document's
 * first sync sends its whole state in one, with the document's id; a larger one
 * would never reach the server.
 */
export const MAX_MOVE_BYTES = 4 * 1024 * 1024 - 1024;

/** A document this browser keeps signed out, as offered to move into an account. */
export interface SignedOutDocument {
    id: string;
    name: string;
    /** The size of its whole state. */
    bytes: number;
    state: Uint8Array;
    /** The hashes of the images it shows. */
    images: string[];
}

/** How the offer ended, for the person to be told. */
export interface MoveResult {
    moved: SignedOutDocument[];
    /** Over `MAX_MOVE_BYTES`, so kept in this browser. */
    tooLarge: SignedOutDocument[];
    /** Not moved for another reason, as storage that cannot be written; offered again. */
    failed: SignedOutDocument[];
}

type Effects = Pick<Context['effects'], 'openDocumentDatabase' | 'loadState' | 'saveState'>;

/** Where this browser records the signed-out documents an account was offered. */
export const offeredKey = (owner: string) => `${PERSISTENCE_KEY}:offered:${owner}`;

export const tooLarge = ({ bytes }: Pick<SignedOutDocument, 'bytes'>) => bytes > MAX_MOVE_BYTES;

function offered(effects: Effects, owner: string): Set<string> {
    try {
        const ids: unknown = effects.loadState(offeredKey(owner));

        return new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : []);
    } catch {
        return new Set();
    }
}

/** Records documents as offered, so `owner` is not asked about them again. */
function remember(effects: Effects, owner: string, documentIds: string[]) {
    try {
        effects.saveState(offeredKey(owner), [...offered(effects, owner), ...documentIds]);
    } catch {
        // Without the record, they are offered again on the next start.
    }
}

/**
 * The hashes of the images a document's shapes show, imported library components'
 * included; as `imageHashes` in assetSync.ts, which loads only with the server sync.
 */
const imageHashes = (document: Document) =>
    new Set(
        [
            ...Object.values(document.shapes),
            ...Object.values(document.components).flatMap((component) =>
                Object.values(component.sourceShapes ?? {})
            )
        ].flatMap((shape) =>
            shape.type === 'image' && shape.source.startsWith('asset:')
                ? [shape.source.slice('asset:'.length)]
                : []
        )
    );

/** A document with nothing in it, like the one a first visit starts. */
const isBlank = (document: Document) =>
    COLLECTIONS.every((collection) => Object.keys(document[collection]).length === 0);

/**
 * The documents this browser keeps signed out that `owner` has not been offered:
 * not blank ones, ones in Recently Deleted, or ones the account already holds.
 */
export async function listSignedOutDocuments(
    effects: Effects,
    owner: string,
    held: (documentId: string) => boolean
): Promise<SignedOutDocument[]> {
    const asked = offered(effects, owner);
    const database = await effects.openDocumentDatabase();
    const found: SignedOutDocument[] = [];

    try {
        for (const id of await database.documentIds()) {
            if (held(id) || asked.has(id)) {
                continue;
            }

            // One that cannot be read is left as saved; the others are still offered.
            const updates = await database.load(id).catch(() => []);
            let state: Uint8Array | undefined;

            try {
                state = updates.length > 0 ? Y.mergeUpdates(updates) : undefined;
            } catch {
                state = undefined;
            }

            const document = state && snapshotDocument(state, id);

            if (state && document && !document.deleted && !isBlank(document)) {
                found.push({
                    id,
                    name: document.name,
                    bytes: state.byteLength,
                    state,
                    images: [...imageHashes(document)]
                });
            }
        }
    } finally {
        database.close();
    }

    return found;
}

/**
 * Records a document in `owner`'s record of documents made on this device, which
 * the server sync creates on the server; recorded before the document is saved
 * for the account, so no copy that finds it there takes it for one deleted elsewhere.
 */
function recordUnsent(effects: Effects, owner: string, documentId: string) {
    const { recordKey } = accountCopy(owner);
    const record: unknown = effects.loadState(recordKey);
    const ids = (key: string): string[] => {
        const value: unknown = Reflect.get(Object(record), key);

        return Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [];
    };

    effects.saveState(recordKey, {
        unsent: [...new Set([...ids('unsent'), documentId])],
        deleting: ids('deleting')
    });
}

/**
 * Moves `documents` from this browser signed out into `owner`'s account, with
 * their images: each is saved in the account's copy in this browser and recorded
 * as made here, so the editor opens it and creates it on the server when it next
 * catches up, then removed from what this browser keeps signed out. One too large
 * stays; neither is offered again, while one that fails is.
 */
export async function moveSignedOutDocuments(
    effects: Effects,
    owner: string,
    documents: SignedOutDocument[]
): Promise<MoveResult> {
    const result: MoveResult = { moved: [], tooLarge: [], failed: [] };
    const source = await effects.openDocumentDatabase();

    try {
        const target = await effects.openDocumentDatabase(accountCopy(owner).database);

        try {
            for (const document of documents) {
                if (tooLarge(document)) {
                    result.tooLarge.push(document);
                    continue;
                }

                try {
                    for (const hash of document.images) {
                        const image = await source.asset(hash);

                        if (image) {
                            await target.putAsset(image);
                        }
                    }

                    recordUnsent(effects, owner, document.id);
                    await target.create(document.id, document.state);
                    result.moved.push(document);
                } catch {
                    result.failed.push(document);
                    continue;
                }

                // One left behind is not offered again, as the account holds it.
                await source.remove(document.id).catch(() => undefined);
            }
        } finally {
            target.close();
        }
    } catch {
        // The account's copy could not be opened, so nothing moved.
        documents.forEach((document) =>
            (tooLarge(document) ? result.tooLarge : result.failed).push(document)
        );
    } finally {
        source.close();
    }

    remember(
        effects,
        owner,
        [...result.moved, ...result.tooLarge].map(({ id }) => id)
    );

    return result;
}

/** Keeps `documents` in this browser signed out, and does not offer them to `owner` again. */
export function keepSignedOutDocuments(
    effects: Effects,
    owner: string,
    documents: SignedOutDocument[]
) {
    remember(
        effects,
        owner,
        documents.map(({ id }) => id)
    );
}
