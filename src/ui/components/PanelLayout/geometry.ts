import type { CSSProperties } from 'react';

export const SIDE_ZONE_WIDTH_RATIO = 0.35;
export const SIDE_ZONE_MAX_WIDTH_PX = 360;
export const EDGE_ZONE_HEIGHT_RATIO = 0.28;
export const STATUS_BAR_HEIGHT_PX = 25;

// Keep the visible zones and pointer hit testing on the same dimensions.
export const DOCK_GEOMETRY_STYLE = {
    '--dock-side-width': `min(${SIDE_ZONE_WIDTH_RATIO * 100}vw, ${SIDE_ZONE_MAX_WIDTH_PX}px)`,
    '--dock-edge-height': `${EDGE_ZONE_HEIGHT_RATIO * 100}vh`,
    '--dock-bottom-inset': `${STATUS_BAR_HEIGHT_PX}px`
} as CSSProperties;
