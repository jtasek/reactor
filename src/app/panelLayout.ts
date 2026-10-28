import type { PanelPlacement } from './types';

export const PANEL_LAYOUT_KEY = 'reactor:panel-layout';

export const DEFAULT_PANEL_LAYOUT: Record<string, PanelPlacement> = {
    preview: { dock: null, position: { x: 380, y: 80 }, size: { width: 440, height: 560 } },
    aiEdit: { dock: null, position: { x: 960, y: 80 }, size: { height: 480 } },
    explorer: { dock: 'left', position: { x: 12, y: 12 } },
    components: { dock: 'left', position: { x: 12, y: 12 } },
    controlPanel: { dock: 'top-right', position: { x: 1012, y: 8 } },
    inspector: { dock: null, position: { x: 700, y: 80 } },
    layerPanel: { dock: null, position: { x: 700, y: 60 } },
    groupPanel: { dock: null, position: { x: 900, y: 60 } },
    miniMap: { dock: null, position: { x: 1030, y: 550 } },
    documentInfo: { dock: null, position: { x: 1050, y: 80 } },
    dataView: { dock: null, position: { x: 600, y: 120 } },
    stats: { dock: 'bottom-right', position: { x: 900, y: 550 } },
    // Offset from Preview's default so both title bars stay reachable when both are open.
    variables: { dock: null, position: { x: 420, y: 120 }, size: { width: 680, height: 560 } }
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

const isLength = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0;

const readSize = (value: unknown) => {
    if (typeof value !== 'object' || value === null) {
        return undefined;
    }

    const width = 'width' in value ? value.width : undefined;
    const height = 'height' in value ? value.height : undefined;

    if (
        (width === undefined && height === undefined) ||
        (width !== undefined && !isLength(width)) ||
        (height !== undefined && !isLength(height))
    ) {
        return undefined;
    }

    return {
        ...(width === undefined ? {} : { width }),
        ...(height === undefined ? {} : { height })
    };
};

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

        const { dock, position, size, order } = saved as Record<string, unknown>;

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
            const chosen = readSize(size);

            layout[id] = {
                dock: dock as PanelPlacement['dock'],
                position: { x: position.x, y: position.y },
                ...(chosen ? { size: chosen } : {}),
                ...(typeof order === 'number' && Number.isFinite(order) ? { order } : {})
            };
        } else {
            layout[id] = fallback;
        }
    });

    return layout;
}
