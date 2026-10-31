import React, {
    FC,
    KeyboardEvent,
    PointerEvent,
    RefObject,
    useEffect,
    useLayoutEffect,
    useRef,
    useState
} from 'react';
import { createPortal } from 'react-dom';
import { Pipette, X } from 'lucide-react';
import { useActions } from 'src/app/hooks';
import { Icon } from '../Icon';
import styles from './styles.css';

const GAP = 8;

type Rgb = [number, number, number];
/** Hue in degrees, saturation and brightness from 0 to 1. */
type Hsv = { h: number; s: number; v: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const hexToRgb = (hex: string): Rgb | undefined => {
    const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
    if (!match) {
        return undefined;
    }
    const digits =
        match[1].length === 3 ? [...match[1]].map((digit) => digit + digit).join('') : match[1];

    return [0, 2, 4].map((start) => Number.parseInt(digits.slice(start, start + 2), 16)) as Rgb;
};

export const rgbToHex = (rgb: Rgb) =>
    `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;

export const rgbToHsv = ([r, g, b]: Rgb): Hsv => {
    const [red, green, blue] = [r / 255, g / 255, b / 255];
    const max = Math.max(red, green, blue);
    const range = max - Math.min(red, green, blue);
    let h = 0;
    if (range > 0) {
        h =
            max === red
                ? ((green - blue) / range) % 6
                : max === green
                  ? (blue - red) / range + 2
                  : (red - green) / range + 4;
    }

    return { h: (h * 60 + 360) % 360, s: max === 0 ? 0 : range / max, v: max };
};

export const hsvToRgb = ({ h, s, v }: Hsv): Rgb => {
    const channel = (n: number) => {
        const k = (n + h / 60) % 6;

        return (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255;
    };

    return [channel(5), channel(3), channel(1)];
};

const toHsv = (hex: string) => rgbToHsv(hexToRgb(hex) ?? [0, 0, 0]);

/** Saturation and lightness, from 0 to 1, for the hue an Hsv color already has. */
export const hsvToHsl = ({ s, v }: Hsv) => {
    const l = v * (1 - s / 2);

    return { s: l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l), l };
};

export const hslToHsv = (h: number, s: number, l: number): Hsv => {
    const v = l + s * Math.min(l, 1 - l);

    return { h, s: v === 0 ? 0 : 2 * (1 - l / v), v };
};

type Format = 'RGB' | 'HSL' | 'HSB';
const FORMAT_KEY = 'reactor:color-format';

/** The number fields' format, remembered on this device between openings. */
const readFormat = (): Format => {
    try {
        const stored = localStorage.getItem(FORMAT_KEY);

        return stored === 'HSL' || stored === 'HSB' ? stored : 'RGB';
    } catch {
        return 'RGB';
    }
};

const CHANNELS: Record<Format, { name: string; label: string; max: number }[]> = {
    RGB: [
        { name: 'R', label: 'Red', max: 255 },
        { name: 'G', label: 'Green', max: 255 },
        { name: 'B', label: 'Blue', max: 255 }
    ],
    HSL: [
        { name: 'H', label: 'Hue (degrees)', max: 360 },
        { name: 'S', label: 'Saturation (%)', max: 100 },
        { name: 'L', label: 'Lightness (%)', max: 100 }
    ],
    HSB: [
        { name: 'H', label: 'Hue (degrees)', max: 360 },
        { name: 'S', label: 'Saturation (%)', max: 100 },
        { name: 'B', label: 'Brightness (%)', max: 100 }
    ]
};

/** Follows a press across an element, reporting where it is as fractions of its box. */
function useDrag(onMove: (x: number, y: number) => void) {
    const { holdSharing, releaseSharing } = useActions();
    const move = (event: PointerEvent<HTMLElement>) => {
        const box = event.currentTarget.getBoundingClientRect();
        onMove(
            clamp((event.clientX - box.left) / box.width, 0, 1),
            clamp((event.clientY - box.top) / box.height, 0, 1)
        );
    };

    return {
        onPointerDown: (event: PointerEvent<HTMLElement>) => {
            if (event.button !== 0) {
                return;
            }
            // Focus first, so the field the focus leaves releases its hold before this one holds.
            event.preventDefault();
            event.currentTarget.focus();
            event.currentTarget.setPointerCapture(event.pointerId);
            holdSharing();
            move(event);
        },
        onPointerMove: (event: PointerEvent<HTMLElement>) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                move(event);
            }
        },
        onLostPointerCapture: () => releaseSharing()
    };
}

/** Arrow keys step by one, or by ten with Shift; Home and End go to the ends. */
const step = (event: KeyboardEvent, keys: { less: string[]; more: string[] }) => {
    const amount = event.shiftKey ? 10 : 1;
    if (keys.less.includes(event.key)) {
        return -amount;
    }
    if (keys.more.includes(event.key)) {
        return amount;
    }

    return 0;
};

const ChannelField: FC<{
    name: string;
    label: string;
    max: number;
    value: number;
    onCommit: (value: number) => void;
}> = ({ name, label, max, value, onCommit }) => {
    const [draft, setDraft] = useState<string>();
    const commit = () => {
        const number = Number(draft);
        if (draft !== undefined && draft.trim() !== '' && Number.isFinite(number)) {
            onCommit(clamp(Math.round(number), 0, max));
        }
        setDraft(undefined);
    };

    return (
        <label className={styles.channel}>
            <span aria-hidden="true">{name}</span>
            <input
                type="number"
                min={0}
                max={max}
                step={1}
                inputMode="numeric"
                aria-label={label}
                value={draft ?? Math.round(value)}
                onChange={(event) => {
                    // The spinner's arrows apply at once; typing waits for Enter or blur.
                    if ((event.nativeEvent as InputEvent).inputType === undefined) {
                        onCommit(clamp(Number(event.target.value), 0, max));
                        setDraft(undefined);

                        return;
                    }
                    setDraft(event.target.value);
                }}
                onBlur={commit}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        commit();
                    }
                }}
            />
        </label>
    );
};

type EyeDropperWindow = Window & {
    EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> };
};

/** Reactor's color editor: a glass popover beside a color field. */
export const ColorEditor: FC<{
    anchor: RefObject<HTMLInputElement | null>;
    label: string;
    value: string;
    onValue: (value: string) => void;
    onClose: () => void;
}> = ({ anchor, label, value, onValue, onClose }) => {
    const { releaseSharing } = useActions();
    const popover = useRef<HTMLDivElement>(null);
    const outsidePress = useRef(false);
    // The editor keeps its own hue and saturation, which grays and black do not carry.
    const [hsv, setHsv] = useState(() => toHsv(value));
    const [hexDraft, setHexDraft] = useState<string>();
    const [format, setFormat] = useState(readFormat);
    const shown = rgbToHex(hsvToRgb(hsv));
    const rgb = hexToRgb(shown) ?? [0, 0, 0];
    const EyeDropper = (window as EyeDropperWindow).EyeDropper;

    useEffect(() => {
        if (value.toLowerCase() !== shown) {
            setHsv(toHsv(value));
        }
        // Only a change from elsewhere, as an undo, moves the editor.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const apply = (next: Hsv) => {
        setHsv(next);
        const hex = rgbToHex(hsvToRgb(next));
        if (hex !== value.toLowerCase()) {
            onValue(hex);
        }
    };
    const applyHex = (hex: string) => {
        const color = hexToRgb(hex);
        if (color) {
            apply(rgbToHsv(color));
        }
    };

    useLayoutEffect(() => {
        const element = popover.current;
        const field = anchor.current;
        if (!element || !field) {
            return;
        }
        element.showPopover();
        const bounds = field.getBoundingClientRect();
        const { width, height } = element.getBoundingClientRect();
        const below = bounds.bottom + GAP;
        const top = below + height <= window.innerHeight - GAP ? below : bounds.top - height - GAP;
        element.style.left = `${clamp(bounds.right - width, GAP, window.innerWidth - width - GAP)}px`;
        element.style.top = `${clamp(top, GAP, Math.max(GAP, window.innerHeight - height - GAP))}px`;
        // The dialog takes focus, so Tab reaches its controls without a ring drawn on open.
        element.focus();
    }, [anchor]);

    useEffect(() => {
        const element = popover.current;
        // The editor's keys are its own, not the canvas shortcuts'. Stopped on the document,
        // after React has handled them on the page (the editor's portal container). Releases
        // still pass, so a key held as the editor opened is not left pressed.
        const keep = (event: Event) => {
            if (event.target instanceof Node && element?.contains(event.target)) {
                event.stopPropagation();
            }
        };
        // A press elsewhere closes the editor and keeps the focus it gives, as on the canvas.
        const pressOutside = (event: Event) => {
            outsidePress.current = !(
                event.target instanceof Node && element?.contains(event.target)
            );
        };
        document.addEventListener('keydown', keep);
        document.addEventListener('pointerdown', pressOutside, true);
        const close = () => popover.current?.hidePopover();
        // Placed once, the editor would drift away from its field as the page scrolls.
        const closeOnScroll = (event: Event) => {
            if (!(event.target instanceof Node && popover.current?.contains(event.target))) {
                close();
            }
        };
        window.addEventListener('resize', close);
        window.addEventListener('scroll', closeOnScroll, true);

        return () => {
            window.removeEventListener('resize', close);
            window.removeEventListener('scroll', closeOnScroll, true);
            document.removeEventListener('keydown', keep);
            document.removeEventListener('pointerdown', pressOutside, true);
            releaseSharing();
        };
    }, [releaseSharing]);

    const areaDrag = useDrag((x, y) => apply({ ...hsv, s: x, v: 1 - y }));
    const hueDrag = useDrag((x) => apply({ ...hsv, h: x * 360 }));
    const hueColor = rgbToHex(hsvToRgb({ h: hsv.h, s: 1, v: 1 }));
    const percent = (fraction: number) => `${Math.round(fraction * 100)}%`;
    const hsl = hsvToHsl(hsv);
    const channelValues =
        format === 'RGB'
            ? rgb
            : format === 'HSL'
              ? [hsv.h, hsl.s * 100, hsl.l * 100]
              : [hsv.h, hsv.s * 100, hsv.v * 100];
    const setChannel = (index: number, channel: number) => {
        if (format === 'RGB') {
            const next = [...rgb] as Rgb;
            next[index] = channel;
            apply(rgbToHsv(next));

            return;
        }
        const next = [...channelValues];
        next[index] = channel;
        apply(
            format === 'HSL'
                ? hslToHsv(next[0], next[1] / 100, next[2] / 100)
                : { h: next[0], s: next[1] / 100, v: next[2] / 100 }
        );
    };
    const chooseFormat = (next: Format) => {
        setFormat(next);
        try {
            localStorage.setItem(FORMAT_KEY, next);
        } catch {
            // Without storage the choice lasts until the editor closes.
        }
    };

    // On the page itself, so the panel's own field and button styles stay out of the editor.
    return createPortal(
        <div
            ref={popover}
            popover="auto"
            role="dialog"
            tabIndex={-1}
            aria-label={`${label} color`}
            className={styles.editor}
            onToggle={(event) => {
                if (event.newState === 'closed') {
                    onClose();
                    // Escape and the close button hand the focus back to the field.
                    if (!outsidePress.current) {
                        anchor.current?.focus();
                    }
                }
            }}
        >
            <header className={styles.header}>
                <span className={styles.title}>{label}</span>
                <div className={styles.formats} role="group" aria-label="Number format">
                    {(['RGB', 'HSL', 'HSB'] as const).map((choice) => (
                        <button
                            key={choice}
                            type="button"
                            aria-pressed={format === choice}
                            onClick={() => chooseFormat(choice)}
                        >
                            {choice}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    className={styles.close}
                    aria-label="Close"
                    title="Close"
                    onClick={() => popover.current?.hidePopover()}
                >
                    <Icon icon={{ component: X, size: 14 }} />
                </button>
            </header>
            <div
                className={styles.area}
                style={{ backgroundColor: hueColor }}
                role="slider"
                tabIndex={0}
                aria-label="Saturation and brightness"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(hsv.s * 100)}
                aria-valuetext={`Saturation ${percent(hsv.s)}, brightness ${percent(hsv.v)}`}
                {...areaDrag}
                onKeyDown={(event) => {
                    const s = step(event, { less: ['ArrowLeft'], more: ['ArrowRight'] });
                    const v = step(event, { less: ['ArrowDown'], more: ['ArrowUp'] });
                    if (s || v) {
                        event.preventDefault();
                        apply({
                            ...hsv,
                            s: clamp(hsv.s + s / 100, 0, 1),
                            v: clamp(hsv.v + v / 100, 0, 1)
                        });
                    }
                }}
            >
                <span
                    className={styles.thumb}
                    style={{
                        left: percent(hsv.s),
                        top: percent(1 - hsv.v),
                        backgroundColor: shown
                    }}
                />
            </div>
            <div className={styles.row}>
                {EyeDropper && (
                    <button
                        type="button"
                        className={styles.tool}
                        aria-label="Pick a color from the screen"
                        title="Pick a color from the screen"
                        onClick={() => {
                            new EyeDropper()
                                .open()
                                .then((result) => applyHex(result.sRGBHex))
                                .catch(() => undefined);
                        }}
                    >
                        <Icon icon={{ component: Pipette, size: 16 }} />
                    </button>
                )}
                <div
                    className={styles.hue}
                    role="slider"
                    tabIndex={0}
                    aria-label="Hue"
                    aria-valuemin={0}
                    aria-valuemax={360}
                    aria-valuenow={Math.round(hsv.h)}
                    aria-valuetext={`${Math.round(hsv.h)} degrees`}
                    {...hueDrag}
                    onKeyDown={(event) => {
                        const amount = step(event, {
                            less: ['ArrowLeft', 'ArrowDown'],
                            more: ['ArrowRight', 'ArrowUp']
                        });
                        const h =
                            event.key === 'Home'
                                ? 0
                                : event.key === 'End'
                                  ? 360
                                  : amount && clamp(hsv.h + amount, 0, 360);
                        if (amount || event.key === 'Home' || event.key === 'End') {
                            event.preventDefault();
                            apply({ ...hsv, h });
                        }
                    }}
                >
                    <span
                        className={styles.hueThumb}
                        style={{ left: percent(hsv.h / 360), backgroundColor: hueColor }}
                    />
                </div>
            </div>
            <div className={styles.values}>
                <span className={styles.swatch} style={{ backgroundColor: shown }} />
                <label className={styles.hex}>
                    <span aria-hidden="true">#</span>
                    <input
                        type="text"
                        aria-label="Hex"
                        spellCheck={false}
                        autoComplete="off"
                        maxLength={7}
                        value={hexDraft ?? shown.slice(1).toUpperCase()}
                        onChange={(event) => setHexDraft(event.target.value)}
                        onBlur={() => {
                            if (hexDraft !== undefined) {
                                applyHex(hexDraft);
                            }
                            setHexDraft(undefined);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && hexDraft !== undefined) {
                                applyHex(hexDraft);
                                setHexDraft(undefined);
                            }
                        }}
                    />
                </label>
            </div>
            <div className={styles.channels}>
                {CHANNELS[format].map((channel, index) => (
                    <ChannelField
                        key={channel.name}
                        {...channel}
                        value={channelValues[index]}
                        onCommit={(value) => setChannel(index, value)}
                    />
                ))}
            </div>
        </div>,
        document.body
    );
};
