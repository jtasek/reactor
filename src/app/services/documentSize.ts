import type * as Yjs from 'yjs';

import type { DocumentSizeConfiguration } from './documentSizeConfiguration';

export { DEFAULT_DOCUMENT_SIZE, type DocumentSizeConfiguration } from './documentSizeConfiguration';

const MIB = 1024 * 1024;

export type SizeLevel = 'fits' | 'large' | 'tooLarge';

export const sizeLevel = (
    bytes: number,
    { warningBytes, uploadBytes }: Pick<DocumentSizeConfiguration, 'warningBytes' | 'uploadBytes'>
): SizeLevel => (bytes > uploadBytes ? 'tooLarge' : bytes >= warningBytes ? 'large' : 'fits');

/** Rounded up, so a document just over a limit never reads as the limit itself. */
export const formatSize = (bytes: number) =>
    `${(Math.ceil((bytes / MIB) * 10) / 10).toFixed(1)} MB`;

/**
 * The size of the state as another copy would receive it, without the deleted
 * content this copy keeps for undo. That takes reading the state into a new copy,
 * so it is done only when the encoded state is over `above`.
 */
export function measureDocument(
    state: () => Uint8Array,
    yjs: Pick<typeof Yjs, 'Doc' | 'applyUpdate' | 'encodeStateAsUpdate'>,
    above: number
): number | undefined {
    let encoded: Uint8Array;

    try {
        encoded = state();
    } catch {
        return undefined;
    }

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

/** The limit goes unnamed, as a document just over it reads as the same size. */
export const tooLargeMessage = (name: string | undefined, bytes: number) =>
    `${name ? `“${name}”` : 'A document'} is ${formatSize(bytes)}, more than the server takes at once. It is kept only in this browser until it is smaller.`;
