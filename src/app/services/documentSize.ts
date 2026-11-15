import type * as Yjs from 'yjs';

/**
 * How large a document's shared state may grow. With no imports but types, so the editor's
 * notices, the server sync and moving signed-out documents share one measure.
 */

const MIB = 1024 * 1024;

/** The size from which the editor warns that a document is growing too large to sync. */
export const SIZE_WARNING_BYTES = 3 * MIB;

/**
 * The most a document's state may weigh to reach the server when it is first
 * uploaded. The server takes messages of at most 4 MiB (`MAX_MESSAGE` in
 * server/sync.ts), and a document's first sync sends its whole state in one, with
 * the document's id; a larger one would never arrive.
 */
export const MAX_UPLOAD_BYTES = 4 * MIB - 1024;

/** Whether a document of `bytes` fits, is large enough to warn about, or cannot be uploaded. */
export type SizeLevel = 'fits' | 'large' | 'tooLarge';

export const sizeLevel = (bytes: number): SizeLevel =>
    bytes > MAX_UPLOAD_BYTES ? 'tooLarge' : bytes >= SIZE_WARNING_BYTES ? 'large' : 'fits';

/**
 * A size as people read it, in megabytes to one decimal, rounded up so a document
 * just over a limit never reads as the limit itself.
 */
export const formatSize = (bytes: number) =>
    `${(Math.ceil((bytes / MIB) * 10) / 10).toFixed(1)} MB`;

/**
 * The size of a document's whole state as it would reach another copy: `state` as
 * encoded, less the content of deleted items this copy keeps for undo, which a
 * copy starting from it drops. Undefined when the state cannot be read. Dropping
 * that content means reading the state into a new copy, several times slower than
 * encoding it (about 150 ms at 3 MB of shapes), so it is done only when the state
 * as encoded is over `above`; below it, the encoded size is the answer.
 */
export function measureDocument(
    state: () => Uint8Array,
    yjs: Pick<typeof Yjs, 'Doc' | 'applyUpdate' | 'encodeStateAsUpdate'>,
    above = SIZE_WARNING_BYTES
): number | undefined {
    let encoded: Uint8Array;

    try {
        encoded = state();
    } catch {
        return undefined;
    }

    // Kept content only adds, so a state small enough as it is needs no second look.
    if (encoded.byteLength <= above) {
        return encoded.byteLength;
    }

    const copy = new yjs.Doc();

    try {
        yjs.applyUpdate(copy, encoded);

        return yjs.encodeStateAsUpdate(copy).byteLength;
    } finally {
        copy.destroy();
    }
}

/**
 * Why a document is kept only in this browser: the server could not take it whole.
 * The limit goes unnamed, as a document just over it reads as the same size.
 */
export const tooLargeMessage = (name: string | undefined, bytes: number) =>
    `${name ? `“${name}”` : 'A document'} is ${formatSize(bytes)}, more than the server takes at once. It is kept only in this browser until it is smaller.`;
