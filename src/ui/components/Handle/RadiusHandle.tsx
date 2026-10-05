import React, { FC } from 'react';

import styles from './styles.css';
import { useCameraScale } from 'src/app/hooks';
import { CORNER_INWARD, limitCornerRadius } from 'src/app/geometry';
import type { Corner, Point, Rectangle } from 'src/app/types';

/** Sizes on screen, in pixels, whatever the zoom. */
const HANDLE_RADIUS = 4;
/** How far in from its corner a handle stays while the corners are square or hardly round. */
const LEAST_INSET = 12;
/** How far the badge showing the radius sits from the dragged handle. */
const BADGE_OFFSET = 18;
/** Below this length of its shorter side on screen, the handles would crowd the resize handles. */
const MIN_HANDLED_SIDE = 40;

export interface Props {
    rectangle: Rectangle;
    /** The corner whose handle is being dragged, if one is. */
    activeCorner?: Corner;
}

/**
 * The handles that round a rectangle's corners, one inside each corner, where the
 * rounding's arc is centered; dragging any of them in along its corner's diagonal
 * rounds all four. While one is dragged, a badge beside it shows the radius.
 */
export const RadiusHandle: FC<Props> = ({ rectangle, activeCorner }) => {
    const scale = useCameraScale();
    const { position, size } = rectangle;
    const half = Math.min(size.width, size.height) / 2;

    if (half * 2 * scale < MIN_HANDLED_SIDE) {
        return null;
    }

    const radius = limitCornerRadius(size, rectangle.cornerRadius ?? 0);
    // In the corner's quarter, so a handle never covers the middle, where a press moves the shape.
    const inset = Math.min(half / 2, Math.max(radius, LEAST_INSET / scale));
    const corners = Object.entries(CORNER_INWARD) as [Corner, Point][];
    const handleAt = (corner: Corner) => {
        const inward = CORNER_INWARD[corner];

        return {
            x: position.x + (inward.x > 0 ? inset : size.width - inset),
            y: position.y + (inward.y > 0 ? inset : size.height - inset)
        };
    };
    // Above or below the handle, toward the middle, so the badge does not cover it.
    const badge = activeCorner && {
        x: handleAt(activeCorner).x,
        y: handleAt(activeCorner).y + (CORNER_INWARD[activeCorner].y * BADGE_OFFSET) / scale
    };

    return (
        <>
            {corners.map(([corner]) => (
                <circle
                    key={corner}
                    className={
                        corner === activeCorner
                            ? `${styles.handle} ${styles.radius} ${styles.active}`
                            : `${styles.handle} ${styles.radius}`
                    }
                    cx={handleAt(corner).x}
                    cy={handleAt(corner).y}
                    r={HANDLE_RADIUS / scale}
                    data-handle
                    data-shape-id={rectangle.id}
                    data-type="radius"
                    data-corner={corner}
                    onPointerDown={(e) => e.preventDefault()}
                />
            ))}
            {badge && (
                <text
                    className={styles.rotateBadge}
                    transform={`translate(${badge.x} ${badge.y}) rotate(${-(rectangle.rotation ?? 0)}) scale(${1 / scale})`}
                >
                    Radius {Math.round(radius)}
                </text>
            )}
        </>
    );
};
