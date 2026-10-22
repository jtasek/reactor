import { createShape } from 'src/app/factories';
import { readImage } from 'src/app/services/assets';
import { previewFixture } from './preview';
import type { Image } from 'src/app/types';

/** A valid 1 by 1 raster, shared by two differently sized image shapes. */
export const PREVIEW_PNG =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
export const previewImageAsset = async () =>
    (await readImage(new Blob([Uint8Array.from(atob(PREVIEW_PNG), (c) => c.charCodeAt(0))])))!;

export function previewImageFixture(hash: string) {
    const document = previewFixture();
    const photo = {
        ...(createShape({
            type: 'image',
            name: 'Photo',
            order: 'a5',
            source: `asset:${hash}`,
            position: { x: 24, y: 160 },
            size: { width: 120, height: 60 },
            parentFrameId: 'home'
        }) as Image),
        id: 'photo',
        selected: false
    };
    document.shapes.photo = photo;
    document.shapes.copy = {
        ...photo,
        id: 'copy',
        name: 'Second photo',
        order: 'a6',
        position: { x: 180, y: 160 },
        size: { width: 60, height: 120 },
        rotation: 15,
        opacity: 0.5
    };
    document.shapesIds.push('photo', 'copy');

    return document;
}
