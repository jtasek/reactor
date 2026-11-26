import { Monitor, RotateCwSquare, Smartphone, Tablet } from 'lucide-react';
import React, { type ReactNode, useState } from 'react';
import {
    DEVICE_SIZES,
    deviceOfSize,
    type DeviceKind,
    type DeviceSize
} from 'src/app/services/deviceSizes';
import type { Size } from 'src/app/types';
import { Icon } from 'src/ui/components/Icon';
import styles from './Prototype.css';

const KINDS: { kind: DeviceKind; label: string; icon: typeof Smartphone }[] = [
    { kind: 'phone', label: 'Phones', icon: Smartphone },
    { kind: 'tablet', label: 'Tablets', icon: Tablet },
    { kind: 'desktop', label: 'Desktops', icon: Monitor }
];

/** The largest side of a device outline, in pixels. */
const OUTLINE_PX = 40;

const turned = ({ width, height }: Size): Size => ({ width: height, height: width });

/** A device drawn to the shape of its screen. */
function Outline({ kind, size }: { kind: DeviceKind; size: Size }) {
    const scale = OUTLINE_PX / Math.max(size.width, size.height);

    return (
        <span className={styles.outlineBox} aria-hidden="true">
            <span
                className={styles.outline}
                data-kind={kind}
                style={{ width: size.width * scale, height: size.height * scale }}
            />
        </span>
    );
}

/** Picks the Prototype's size from phones, tablets and desktops, upright or turned. */
export function DevicePicker({
    size,
    onSize,
    children
}: {
    size: Size;
    onSize: (size: Size) => void;
    /** The width and height fields, shown as the chosen device's size. */
    children: ReactNode;
}) {
    const devices = DEVICE_SIZES;
    const current = deviceOfSize(devices, size);
    const [kind, setKind] = useState<DeviceKind>(current?.kind ?? 'phone');
    // Desktops are always wide; phones and tablets stand upright until turned.
    const landscape = kind !== 'desktop' && size.width > size.height;
    const shown = devices.filter((device) => device.kind === kind);
    const oriented = (device: DeviceSize) =>
        device.kind !== 'desktop' && landscape ? turned(device.size) : device.size;

    return (
        <fieldset className={styles.devices}>
            <legend>Device</legend>
            <div className={styles.deviceBar}>
                <div className={styles.deviceKinds} role="group" aria-label="Device type">
                    {KINDS.map((option) => (
                        <button
                            key={option.kind}
                            type="button"
                            aria-pressed={kind === option.kind}
                            onClick={() => setKind(option.kind)}
                        >
                            <Icon icon={{ component: option.icon, size: 14 }} />
                            {option.label}
                        </button>
                    ))}
                </div>
                {kind !== 'desktop' && (
                    <button
                        className={styles.turn}
                        type="button"
                        aria-pressed={landscape}
                        aria-label="Landscape"
                        title="Landscape"
                        onClick={() => onSize(turned(size))}
                    >
                        <Icon icon={{ component: RotateCwSquare, size: 16 }} />
                    </button>
                )}
            </div>
            <div className={styles.deviceList}>
                {shown.map((device) => {
                    const deviceSize = oriented(device);

                    return (
                        <label key={device.id} className={styles.device}>
                            <input
                                type="radio"
                                name="prototype-device"
                                checked={current?.id === device.id}
                                onChange={() => onSize({ ...deviceSize })}
                            />
                            <Outline kind={device.kind} size={deviceSize} />
                            <span className={styles.deviceText}>
                                <span>{device.name}</span>
                                <small>
                                    {deviceSize.width} × {deviceSize.height}
                                </small>
                            </span>
                        </label>
                    );
                })}
            </div>
            <div className={styles.deviceSize}>
                <span className={styles.deviceSizeFields}>{children}</span>
                <span className={styles.deviceSizeName}>{current?.name ?? 'Custom size'}</span>
            </div>
        </fieldset>
    );
}
