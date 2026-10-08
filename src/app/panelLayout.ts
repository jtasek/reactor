import type { PanelPlacement } from './types';

export const PANEL_LAYOUT_KEY = 'reactor:panel-layout';

export const DEFAULT_PANEL_LAYOUT: Record<string, PanelPlacement> = {
    sideBar: { dock: 'left', position: { x: 12, y: 12 } },
    controlPanel: { dock: null, position: { x: 1100, y: 8 } },
    inspector: { dock: null, position: { x: 700, y: 80 } },
    layerPanel: { dock: null, position: { x: 700, y: 60 } },
    groupPanel: { dock: null, position: { x: 900, y: 60 } },
    miniMap: { dock: null, position: { x: 1030, y: 550 } },
    documentInfo: { dock: null, position: { x: 1050, y: 80 } },
    dataView: { dock: null, position: { x: 600, y: 120 } },
    stats: { dock: null, position: { x: 900, y: 550 } },
    variables: { dock: null, position: { x: 380, y: 360 } }
};

const docks = new Set([
    'top-left',
    'left',
    'bottom-left',
    'top-right',
    'right',
    'bottom-right',
    'top',
    'bottom'
]);

export function readPanelLayout(value: unknown): Record<string, PanelPlacement> {
    const layout = { ...DEFAULT_PANEL_LAYOUT };

    if (typeof value !== 'object' || value === null) {
        return layout;
    }

    Object.entries(DEFAULT_PANEL_LAYOUT).forEach(([id, fallback]) => {
        const saved = (value as Record<string, unknown>)[id];

        if (typeof saved !== 'object' || saved === null) {
            return;
        }

        const { dock, position } = saved as Record<string, unknown>;

        if (
            (dock === null || (typeof dock === 'string' && docks.has(dock))) &&
            typeof position === 'object' &&
            position !== null &&
            'x' in position &&
            'y' in position &&
            typeof position.x === 'number' &&
            Number.isFinite(position.x) &&
            typeof position.y === 'number' &&
            Number.isFinite(position.y)
        ) {
            layout[id] = {
                dock: dock as PanelPlacement['dock'],
                position: { x: position.x, y: position.y }
            };
        } else {
            layout[id] = fallback;
        }
    });

    return layout;
}
