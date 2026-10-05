import React, { FC } from 'react';

import styles from './styles.css';
import { useCameraScale } from 'src/app/hooks';
import { limitCornerRadius } from 'src/app/geometry';
import type { Rectangle } from 'src/app/types';

/** Sizes on screen, in pixels, whatever the zoom. */
const HANDLE_RADIUS = 4;
/** How far in from the corner the handle stays while the corners are square or hardly round. */
const LEAST_INSET = 12;
/** Below this length of its shorter side on screen, the handle would crowd the resize handles. */
const MIN_HANDLED_SIDE = 40;

export interface Props {
    rectangle: Rectangle;
    active: boolean;
}

/**
 * The handle that rounds a rectangle's corners: inside its top left corner, where
 * the rounding's arc is centered, and dragged in along the diagonal to round more.
 */
export const RadiusHandle: FC<Props> = ({ rectangle, active }) => {
    const scale = useCameraScale();
    const { position, size } = rectangle;
    const half = Math.min(size.width, size.height) / 2;

    if (half * 2 * scale < MIN_HANDLED_SIDE) {
        return null;
    }

    const radius = limitCornerRadius(size, rectangle.cornerRadius ?? 0);
    const inset = Math.min(half, Math.max(radius, LEAST_INSET / scale));
    const classes = [styles.handle, styles.radius, active ? styles.active : undefined];

    return (
        <circle
            className={classes.join(' ')}
            cx={position.x + inset}
            cy={position.y + inset}
            r={HANDLE_RADIUS / scale}
            data-handle
            data-shape-id={rectangle.id}
            data-type="radius"
            onPointerDown={(e) => e.preventDefault()}
        />
    );
};
