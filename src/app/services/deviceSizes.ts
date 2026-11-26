import type { Size } from '../types';

export type DeviceKind = 'phone' | 'tablet' | 'desktop';

export interface DeviceSize {
    id: string;
    name: string;
    kind: DeviceKind;
    /** The size of the browser's page on the device, in CSS pixels, held upright. */
    size: Size;
}

/** Phones, tablets and desktops offered in Prototype settings. */
export const DEVICE_SIZES: DeviceSize[] = [
    { id: 'iphone-se', name: 'iPhone SE', kind: 'phone', size: { width: 375, height: 667 } },
    { id: 'iphone-15', name: 'iPhone 15', kind: 'phone', size: { width: 393, height: 852 } },
    {
        id: 'iphone-15-pro-max',
        name: 'iPhone 15 Pro Max',
        kind: 'phone',
        size: { width: 430, height: 932 }
    },
    { id: 'pixel-8', name: 'Pixel 8', kind: 'phone', size: { width: 412, height: 915 } },
    { id: 'galaxy-s24', name: 'Galaxy S24', kind: 'phone', size: { width: 360, height: 780 } },
    { id: 'ipad-mini', name: 'iPad mini', kind: 'tablet', size: { width: 744, height: 1133 } },
    { id: 'ipad-air', name: 'iPad Air', kind: 'tablet', size: { width: 820, height: 1180 } },
    { id: 'ipad-pro', name: 'iPad Pro 13″', kind: 'tablet', size: { width: 1032, height: 1376 } },
    {
        id: 'galaxy-tab-s9',
        name: 'Galaxy Tab S9',
        kind: 'tablet',
        size: { width: 800, height: 1280 }
    },
    { id: 'laptop', name: 'Laptop', kind: 'desktop', size: { width: 1280, height: 800 } },
    { id: 'desktop', name: 'Desktop', kind: 'desktop', size: { width: 1440, height: 900 } },
    { id: 'wide', name: 'Wide desktop', kind: 'desktop', size: { width: 1920, height: 1080 } }
];

/** The device of a size, upright or turned. */
export function deviceOfSize(devices: readonly DeviceSize[], size: Size | undefined) {
    return devices.find(
        ({ size: device }) =>
            (device.width === size?.width && device.height === size.height) ||
            (device.width === size?.height && device.height === size.width)
    );
}
