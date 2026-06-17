import React, { FC } from 'react';

import { useControls, useCurrentDocument } from 'src/app/hooks';
import { getShapeBounds } from 'src/app/utils';
import { MiniMap } from './MiniMap';
import { Rulers } from '../Surface/Rulers';
import { Shapes } from '../Surface/Shapes';

const STATIC_CAMERA = { position: { x: 0, y: 0 }, scale: 1 };

// Shown when the document is empty, so the minimap still has a sensible extent.
const DEFAULT_VIEW_BOX = '0 0 1000 1000';

/**
 * Computes a viewBox that frames every shape (with a small margin) so the
 * minimap always shows the whole canvas where the shapes are.
 */
const getContentViewBox = (document: ReturnType<typeof useCurrentDocument>): string => {
    const { shapesIds, shapes } = document;

    if (shapesIds.length === 0) {
        return DEFAULT_VIEW_BOX;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    shapesIds.forEach((id: string) => {
        const shape = shapes[id];
        if (!shape) {
            return;
        }

        const { topLeft, bottomRight } = getShapeBounds(shape);
        minX = Math.min(minX, topLeft.x);
        minY = Math.min(minY, topLeft.y);
        maxX = Math.max(maxX, bottomRight.x);
        maxY = Math.max(maxY, bottomRight.y);
    });

    if (!Number.isFinite(minX)) {
        return DEFAULT_VIEW_BOX;
    }

    const width = maxX - minX;
    const height = maxY - minY;
    const margin = Math.max(width, height) * 0.1 || 50;

    return `${minX - margin} ${minY - margin} ${width + margin * 2} ${height + margin * 2}`;
};

export const MiniMapContainer: FC = () => {
    const { miniMap } = useControls();
    const document = useCurrentDocument();

    if (!miniMap.visible) {
        return null;
    }

    const viewBox = getContentViewBox(document);

    return (
        <MiniMap size={{ width: 200, height: 200 }} viewBox={viewBox}>
            <Rulers key="minimap-rulers" camera={STATIC_CAMERA} />
            <Shapes />
        </MiniMap>
    );
};
