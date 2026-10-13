// The editor and the documents page show images, so this hook loads with them rather
// than with `hooks.ts`, which every page needs as it opens.
import { useEffect, useState } from 'react';
import { useEffects } from './hooks';

/** How long a shape whose image is missing waits before asking for it again. */
const MISSING_IMAGE_RETRY_MS = 30_000;

/**
 * An address to show an image shape's `source` from: asked from the kept images
 * for an asset, then from the server's for `documentId`, so none until it is found.
 * One still missing is asked for again while the shape shows, as another copy may
 * upload it later.
 */
export const useImageUrl = (source: string, documentId?: string) => {
    const { assets } = useEffects();
    const [found, setFound] = useState<{ source: string; url?: string }>();
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let current = true;
        let retry: ReturnType<typeof setTimeout> | undefined;

        void assets.url(source, documentId).then((url) => {
            if (!current) {
                return;
            }

            setFound({ source, url });
            if (!url) {
                retry = setTimeout(() => setAttempt((count) => count + 1), MISSING_IMAGE_RETRY_MS);
            }
        });

        return () => {
            current = false;
            clearTimeout(retry);
        };
    }, [assets, source, documentId, attempt]);

    return found?.source === source ? found.url : undefined;
};
