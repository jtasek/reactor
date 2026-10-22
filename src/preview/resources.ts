import { readImage, type createAssets } from '../app/services/assets';
import {
    readPreview,
    readPreviewImages,
    MAX_PREVIEW_BYTES,
    MAX_PREVIEW_IMAGE_BYTES,
    MAX_PREVIEW_NODES,
    type PreviewDrawing,
    type PreviewNode
} from './protocol';

const BASE64_CHUNK_SIZE = 8192;
const encode = (bytes: Uint8Array) => {
    const chunks: string[] = [];
    for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE) {
        chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + BASE64_CHUNK_SIZE)));
    }

    return btoa(chunks.join(''));
};

/** One open panel's image cache. All IO stays in the editor; the sandbox receives only
 * verified bytes as raster data URLs. Failed reads can be retried when sync catches up. */
export function createPreviewResources(assets: Pick<ReturnType<typeof createAssets>, 'read'>) {
    const cache = new Map<string, Promise<{ url: string; bytes: number }>>();
    const load = (hash: string, documentId: string) => {
        const known = cache.get(hash);
        if (known) {
            return known;
        }
        const pending = assets.read(hash, documentId).then(async (asset) => {
            if (!asset) {
                throw new Error(
                    'An image is not available yet. Wait for it to sync, then retry the preview.'
                );
            }
            const image = await readImage(new Blob([asset.bytes], { type: asset.type }));
            if (!image || image.hash !== hash) {
                throw new Error('An image failed verification. Replace it before previewing.');
            }
            try {
                const bitmap = await createImageBitmap(
                    new Blob([image.bytes], { type: image.type })
                );
                bitmap.close();
            } catch {
                throw new Error('An image could not be decoded. Replace it before previewing.');
            }

            const url = `data:${image.type};base64,${encode(image.bytes)}`;
            // Checked once here, so later updates can reuse it without re-reading megabytes.
            readPreviewImages({ [hash]: url });

            return { url, bytes: image.bytes.length };
        });
        cache.set(hash, pending);
        void pending.catch(() => {
            if (cache.get(hash) === pending) {
                cache.delete(hash);
            }
        });

        return pending;
    };

    return async (drawing: PreviewDrawing, signal: AbortSignal) => {
        signal.throwIfAborted();
        if (new TextEncoder().encode(JSON.stringify(drawing)).byteLength > MAX_PREVIEW_BYTES) {
            throw new Error('Preview exceeds the 8 MiB limit.');
        }
        const hashes = new Set<string>();
        let nodes = 0;
        const collect = (node: PreviewNode) => {
            nodes += 1;
            if (nodes > MAX_PREVIEW_NODES) {
                throw new Error('Invalid or excessively complex preview content.');
            }
            if (node.image && !/^[a-f0-9]{64}$/.test(node.image)) {
                throw new Error('Invalid preview image reference.');
            }
            if (node.image) {
                hashes.add(node.image);
            }
            node.children?.forEach(collect);
        };
        drawing.screens.forEach((screen) => screen.nodes.forEach(collect));
        cache.forEach((_value, hash) => {
            if (!hashes.has(hash)) {
                cache.delete(hash);
            }
        });
        const images: Record<string, string> = {};
        let size = 0;
        for (const hash of hashes) {
            signal.throwIfAborted();
            const image = await load(hash, drawing.documentId);
            signal.throwIfAborted();
            images[hash] = image.url;
            size += image.bytes;
            if (size > MAX_PREVIEW_IMAGE_BYTES) {
                throw new Error(
                    'Preview images exceed the 8 MiB limit. Remove or reduce some images.'
                );
            }
        }

        return readPreview(drawing, images);
    };
}
