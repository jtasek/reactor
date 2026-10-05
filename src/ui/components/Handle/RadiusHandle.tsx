import React, { FC } from 'react';

import styles from './styles.css';
import { useCameraScale } from 'src/app/hooks';
import { limitCornerRadius } from 'src/app/geometry';
import type { Rectangle } from 'src/app/types';

/** Sizes on screen, in pixels, whatever the zoom. */
const HANDLE_RADIUS = 4;
/** How far in from the corner the handle stays while the corners are square or hardly round. */
const LEAST_INSET = 12;
/** How far the badge showing the radius sits beside the handle. */
const BADGE_OFFSET = 18;
/** Below this length of its shorter side on screen, the handle would crowd the resize handles. */
const MIN_HANDLED_SIDE = 40;

export interface Props {
    rectangle: Rectangle;
    active: boolean;
}

/**
 * The handle that rounds a rectangle's corners: inside its top left corner, where
 * the rounding's arc is centered, and dragged in along the diagonal to round more.
 * While it is dragged, a badge beside it shows the radius.
 */
export const RadiusHandle: FC<Props> = ({ rectangle, active }) => {
    const scale = useCameraScale();
    const { position, size } = rectangle;
    const half = Math.min(size.width, size.height) / 2;

    if (half * 2 * scale < MIN_HANDLED_SIDE) {
        return null;
    }

    const radius = limitCornerRadius(size, rectangle.cornerRadius ?? 0);
    // In the corner's quarter, so the handle never covers the middle, where a press moves the shape.
    const inset = Math.min(half / 2, Math.max(radius, LEAST_INSET / scale));
    const classes = [styles.handle, styles.radius, active ? styles.active : undefined];
    const at = { x: position.x + inset, y: position.y + inset };
    const badgeAt = { x: at.x + BADGE_OFFSET / scale, y: at.y + BADGE_OFFSET / scale };

    return (
        <>
            <circle
                className={classes.join(' ')}
                cx={at.x}
                cy={at.y}
                r={HANDLE_RADIUS / scale}
                data-handle
                data-shape-id={rectangle.id}
                data-type="radius"
                onPointerDown={(e) => e.preventDefault()}
            />
            {active && (
                <text
                    className={styles.rotateBadge}
                    transform={`translate(${badgeAt.x} ${badgeAt.y}) rotate(${-(rectangle.rotation ?? 0)}) scale(${1 / scale})`}
                >
                    Radius {Math.round(radius)}
                </text>
            )}
        </>
    );
};
