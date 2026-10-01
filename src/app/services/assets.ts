import type { DocumentDatabase } from './documentDatabase';

/** The largest image taken, in bytes. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** How an image shape's `source` names an asset: `asset:` and the SHA-256 of its bytes. */
const ASSET_PREFIX = 'asset:';

const REFUSED = 'That file is not a PNG, JPEG, GIF or WebP image of 5 MB or less.';

/** An image to draw: the asset it shows and its width over its height. */
export interface ImageToPlace {
    source: string;
    ratio: number;
}

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
    signature.every((byte, index) => bytes[offset + index] === byte);

const codes = (text: string) => [...text].map((character) => character.charCodeAt(0));

/** The image type the bytes begin as. SVG is not one: opened directly, it could run script. */
function imageType(bytes: Uint8Array): string | null {
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

/**
 * Reads a file as an image: its type by its content, whatever the file claims,
 * and its name, the SHA-256 of its bytes. Null when it is not an image taken or
 * is over the size limit.
 */
export async function readImage(file: Blob) {
    if (file.size > MAX_IMAGE_BYTES) {
        return null;
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = imageType(bytes);

    if (!type) {
        return null;
    }

    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    const hash = [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');

    return { hash, type, bytes };
}

/** Asks for an image file; null when none is chosen. */
function pickFile(): Promise<Blob | null> {
    return new Promise((resolve) => {
        const input = document.createElement('input');

        input.type = 'file';
        input.accept = 'image/png,image/jpeg,image/gif,image/webp';
        input.onchange = () => resolve(input.files?.[0] ?? null);
        input.oncancel = () => resolve(null);
        input.click();
    });
}

/** An image's size in pixels. */
async function measureImage(image: Blob) {
    const bitmap = await createImageBitmap(image);
    const size = { width: bitmap.width, height: bitmap.height };

    bitmap.close();

    return size;
}

/** The root actions that apply a picked image. */
interface AssetActions {
    tools: {
        setImageToPlace: (image: ImageToPlace) => void;
        activateTool: (toolId: string) => void;
    };
    displayError: (message: string) => void;
}

/**
 * Images kept in the browser's database, for the documents that show them. An
 * image shape names its image `asset:<hash>`; image data never goes into a
 * document.
 */
export function createAssets({ pick = pickFile, measure = measureImage } = {}) {
    let database: Promise<DocumentDatabase | undefined> = Promise.resolve(undefined);
    let actions: AssetActions | undefined;
    const urls = new Map<string, Promise<string | undefined>>();

    const add = async (file: Blob): Promise<ImageToPlace | null> => {
        const image = await readImage(file);
        const opened = await database;

        if (!image || !opened) {
            return null;
        }

        const { width, height } = await measure(new Blob([image.bytes], { type: image.type }));

        if (!(width > 0 && height > 0)) {
            return null;
        }

        await opened.putAsset(image);

        return { source: `${ASSET_PREFIX}${image.hash}`, ratio: width / height };
    };

    return {
        /** Keeps images in `opened`, the database of the documents shown. */
        use(opened: Promise<DocumentDatabase | undefined> | DocumentDatabase | undefined) {
            // A database that cannot be opened keeps no images.
            database = Promise.resolve(opened).catch(() => undefined);
            urls.clear();
        },

        connect(root: AssetActions) {
            actions = root;
        },

        add,

        /**
         * Asks for an image and makes it the one the image tool draws. Without
         * one the select tool takes over, with a notice when a file was refused.
         */
        async pickImage() {
            const file = await pick();
            const image = file && (await add(file).catch(() => null));

            if (image) {
                actions?.tools.setImageToPlace(image);

                return;
            }

            if (file) {
                actions?.displayError(REFUSED);
            }

            actions?.tools.activateTool('select');
        },

        /**
         * An address the browser can show an image shape's `source` from: one
         * made from the kept bytes for an asset, none when it is not kept here,
         * and the source itself for anything else.
         */
        url(source: string): Promise<string | undefined> {
            if (!source.startsWith(ASSET_PREFIX)) {
                return Promise.resolve(source);
            }

            const hash = source.slice(ASSET_PREFIX.length);
            const known = urls.get(hash);

            if (known) {
                return known;
            }

            const created = database
                .then((opened) => opened?.asset(hash))
                .then((asset) =>
                    asset
                        ? URL.createObjectURL(new Blob([asset.bytes], { type: asset.type }))
                        : undefined
                );

            urls.set(hash, created);
            // An image not kept yet may arrive later, so only what was found is remembered.
            void created.then((url) => url ?? urls.delete(hash));

            return created;
        }
    };
}

export const assets = createAssets();
