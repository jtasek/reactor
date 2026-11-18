import type { Size } from '../types';

export interface ViewportPreset {
    id: string;
    name: string;
    size: Size;
}

export const DEFAULT_VIEWPORT_PRESETS: ViewportPreset[] = [
    { id: 'mobile', name: 'Mobile', size: { width: 390, height: 844 } },
    { id: 'tablet', name: 'Tablet', size: { width: 768, height: 1024 } },
    { id: 'desktop', name: 'Desktop', size: { width: 1280, height: 800 } }
];

export function presetOfSize(presets: readonly ViewportPreset[], size: Size | undefined) {
    return presets.find(
        (preset) => preset.size.width === size?.width && preset.size.height === size.height
    );
}
