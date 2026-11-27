import { Monitor, RotateCwSquare, Search, Smartphone, Tablet } from 'lucide-react';
import React, { type ReactNode, useState } from 'react';
import {
    DEVICE_SIZES,
    deviceOfSize,
    type DeviceKind,
    type DeviceSize
} from 'src/app/services/deviceSizes';
import type { Size } from 'src/app/types';
import { Icon } from 'src/ui/components/Icon';
import { Popover } from './Popover';
import styles from './Prototype.css';

/** Stable, so the search takes focus once when the menu opens, not on every change. */
const focusOnOpen = (input: HTMLInputElement | null) => input?.focus({ preventScroll: true });

const GROUPS: { kind: DeviceKind; label: string }[] = [
    { kind: 'phone', label: 'Phones' },
    { kind: 'tablet', label: 'Tablets' },
    { kind: 'desktop', label: 'Desktops' }
];

const KIND_ICONS = { phone: Smartphone, tablet: Tablet, desktop: Monitor };

/** The largest side of a device outline, in pixels. */
const OUTLINE_PX = 16;

const turned = ({ width, height }: Size): Size => ({ width: height, height: width });

/** A device drawn to the shape of its screen. */
function Outline({ size }: { size: Size }) {
    const scale = OUTLINE_PX / Math.max(size.width, size.height);

    return (
        <span className={styles.outlineBox} aria-hidden="true">
            <span
                className={styles.outline}
                style={{ width: size.width * scale, height: size.height * scale }}
            />
        </span>
    );
}

// Desktops are always wide; phones and tablets stand upright until turned.
const isLandscape = (device: DeviceSize | undefined, size: Size) =>
    device?.kind !== 'desktop' && size.width > size.height;

/** Phones and tablets are drawn in a frame; desktops and custom sizes are not. */
export const framed = (device: DeviceSize | undefined) =>
    device?.kind === 'phone' || device?.kind === 'tablet' ? device.kind : undefined;

/** The open menu; its search starts empty each time it opens. */
function DeviceList({
    size,
    onSize,
    frame,
    onFrame,
    close,
    children
}: {
    size: Size;
    onSize: (size: Size) => void;
    frame: boolean;
    onFrame: (frame: boolean) => void;
    close: () => void;
    children: ReactNode;
}) {
    const [query, setQuery] = useState('');
    const current = deviceOfSize(DEVICE_SIZES, size);
    const landscape = isLandscape(current, size);
    const oriented = (device: DeviceSize) =>
        device.kind !== 'desktop' && landscape ? turned(device.size) : device.size;
    const search = query.trim().toLowerCase();
    const shown = DEVICE_SIZES.filter((device) => device.name.toLowerCase().includes(search));

    return (
        <div className={styles.deviceMenu}>
            <label className={styles.deviceSearch}>
                <Icon icon={{ component: Search, size: 16 }} />
                <input
                    type="search"
                    aria-label="Search devices"
                    placeholder="Search"
                    value={query}
                    ref={focusOnOpen}
                    onChange={(event) => setQuery(event.target.value)}
                />
            </label>
            {GROUPS.map((group) => {
                const devices = shown.filter(({ kind }) => kind === group.kind);

                return (
                    devices.length > 0 && (
                        <div key={group.kind} role="group" aria-label={group.label}>
                            <span className={styles.deviceGroup}>{group.label}</span>
                            {devices.map((device) => {
                                const deviceSize = oriented(device);

                                return (
                                    <button
                                        key={device.id}
                                        type="button"
                                        className={styles.deviceRow}
                                        aria-pressed={current?.id === device.id}
                                        onClick={() => {
                                            onSize({ ...deviceSize });
                                            close();
                                        }}
                                    >
                                        <Outline size={deviceSize} />
                                        <span>{device.name}</span>
                                        <small>
                                            {deviceSize.width} × {deviceSize.height}
                                        </small>
                                    </button>
                                );
                            })}
                        </div>
                    )
                );
            })}
            {shown.length === 0 && (
                <p className={styles.deviceEmpty}>No device matches “{query.trim()}”.</p>
            )}
            <div className={styles.customSize} role="group" aria-label="Custom size">
                <span className={styles.deviceGroup}>Custom size</span>
                <span className={styles.customFields}>{children}</span>
            </div>
            <label className={styles.frameSwitch}>
                <input
                    type="checkbox"
                    checked={frame}
                    disabled={!framed(current)}
                    onChange={(event) => onFrame(event.target.checked)}
                />
                Show device frame
            </label>
        </div>
    );
}

/**
 * The Prototype's size: a menu of phones, tablets and desktops with a search and a custom
 * size, and a button that turns phones and tablets on their side.
 */
export function DeviceMenu({
    size,
    onSize,
    frame,
    onFrame,
    children
}: {
    size: Size;
    onSize: (size: Size) => void;
    /** Whether phones and tablets are shown in a device frame. */
    frame: boolean;
    onFrame: (frame: boolean) => void;
    /** The width and height fields for a custom size. */
    children: ReactNode;
}) {
    const current = deviceOfSize(DEVICE_SIZES, size);
    const landscape = isLandscape(current, size);

    return (
        <>
            <Popover
                label="Device"
                className={styles.deviceButton}
                button={
                    <>
                        <Icon
                            icon={{ component: KIND_ICONS[current?.kind ?? 'phone'], size: 16 }}
                        />
                        <span>{current?.name ?? 'Custom size'}</span>
                        <small>
                            {size.width} × {size.height}
                        </small>
                    </>
                }
            >
                {(close) => (
                    <DeviceList
                        size={size}
                        onSize={onSize}
                        frame={frame}
                        onFrame={onFrame}
                        close={close}
                    >
                        {children}
                    </DeviceList>
                )}
            </Popover>
            <button
                type="button"
                className={styles.roundButton}
                aria-label="Landscape"
                title="Landscape"
                aria-pressed={landscape}
                disabled={current?.kind === 'desktop'}
                onClick={() => onSize(turned(size))}
            >
                <Icon icon={{ component: RotateCwSquare, size: 18 }} />
            </button>
        </>
    );
}
