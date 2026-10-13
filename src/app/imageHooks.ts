// The editor and the documents page show images, so this hook loads with them rather
// than with `hooks.ts`, which every page needs as it opens.
import { useEffect, useState } from 'react';
import { useEffects } from './hooks';

/**
 * An address to show an image shape's `source` from: asked from the kept images
 * for an asset, then from the server's for `documentId`, so none until it is found.
 */
export const useImageUrl = (source: string, documentId?: string) => {
    const { assets } = useEffects();
    const [found, setFound] = useState<{ source: string; url?: string }>();

    useEffect(() => {
        let current = true;

        void assets.url(source, documentId).then((url) => {
            if (current) {
                setFound({ source, url });
            }
        });

        return () => {
            current = false;
        };
    }, [assets, source, documentId]);

    return found?.source === source ? found.url : undefined;
};
