import type { CSSProperties } from 'react';

export const EDGE_ZONE_HEIGHT_PX = 56;
export const STATUS_BAR_HEIGHT_PX = 25;

// Keep the visible zones and pointer hit testing on the same dimensions.
export const DOCK_GEOMETRY_STYLE = {
    '--dock-side-width': 'min(var(--control-width), 35vw)',
    '--dock-edge-height': `${EDGE_ZONE_HEIGHT_PX}px`,
    '--dock-bottom-inset': `${STATUS_BAR_HEIGHT_PX}px`
} as CSSProperties;
