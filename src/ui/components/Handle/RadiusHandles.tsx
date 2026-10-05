import React, { FC } from 'react';

import styles from './styles.css';
import { useCameraScale } from 'src/app/hooks';
import { CORNERS, CORNER_INWARD, limitCornerRadius } from 'src/app/geometry';
import { rotatePoint } from 'src/app/utils';
import type { Corner, Rectangle } from 'src/app/types';

/** Sizes on screen, in pixels, whatever the zoom. */
const HANDLE_RADIUS = 4;
/** How far in from its corner a handle stays while the corners are square or hardly round. */
const LEAST_INSET = 12;
/** How far the badge showing the radius sits beside the dragged handle. */
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
export const RadiusHandles: FC<Props> = ({ rectangle, activeCorner }) => {
    const scale = useCameraScale();
    const { position, size } = rectangle;
    const half = Math.min(size.width, size.height) / 2;

    if (half * 2 * scale < MIN_HANDLED_SIDE) {
        return null;
    }

    const radius = limitCornerRadius(size, rectangle.cornerRadius ?? 0);
    const rotation = rectangle.rotation ?? 0;
    // In the corner's quarter, so a handle never covers the middle, where a press moves the shape.
    const inset = Math.min(half / 2, Math.max(radius, LEAST_INSET / scale));
    const handles = CORNERS.map((corner) => {
        const inward = CORNER_INWARD[corner];

        return {
            corner,
            x: position.x + (inward.x > 0 ? inset : size.width - inset),
            y: position.y + (inward.y > 0 ? inset : size.height - inset)
        };
    });
    const dragged = handles.find(({ corner }) => corner === activeCorner);
    // The badge is upright on screen, beside the dragged handle on the side away from the
    // middle, level with it, so it covers neither that handle nor the others.
    const outward =
        dragged &&
        rotatePoint(
            {
                x: dragged.x - (position.x + size.width / 2),
                y: dragged.y - (position.y + size.height / 2)
            },
            { x: 0, y: 0 },
            rotation
        ).x < 0
            ? -1
            : 1;

    return (
        <>
            {handles.map(({ corner, x, y }) => (
                <circle
                    key={corner}
                    className={
                        corner === activeCorner
                            ? `${styles.handle} ${styles.radius} ${styles.active}`
                            : `${styles.handle} ${styles.radius}`
                    }
                    cx={x}
                    cy={y}
                    r={HANDLE_RADIUS / scale}
                    data-handle
                    data-shape-id={rectangle.id}
                    data-type="radius"
                    data-corner={corner}
                    onPointerDown={(e) => e.preventDefault()}
                />
            ))}
            {dragged && (
                <text
                    className={styles.rotateBadge}
                    x={outward * BADGE_OFFSET}
                    style={{ textAnchor: outward < 0 ? 'end' : 'start' }}
                    transform={`translate(${dragged.x} ${dragged.y}) rotate(${-rotation}) scale(${1 / scale})`}
                >
                    Radius {Math.round(radius)}
                </text>
            )}
        </>
    );
};
