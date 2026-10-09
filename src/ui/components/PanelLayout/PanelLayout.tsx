import React, {
    Children,
    FC,
    PointerEvent,
    ReactElement,
    ReactNode,
    useEffect,
    useLayoutEffect,
    useRef,
    useState
} from 'react';
import type { PanelPlacement } from 'src/app/types';
import { useActions, useControls, usePanelLayout } from 'src/app/hooks';
import { beyondClickSlip } from 'src/events/gestures';
import styles from './styles.css';
import { DOCK_GEOMETRY_STYLE, EDGE_ZONE_HEIGHT_PX, STATUS_BAR_HEIGHT_PX } from './geometry';

type Dock = PanelPlacement['dock'];
type DockZone = Exclude<Dock, null>;
type Docking = 'horizontal' | 'vertical' | 'both';

const orientationOf = (dock: Dock) =>
    dock === 'top' || dock === 'bottom' ? 'horizontal' : 'vertical';
const allowsDock = (dock: Dock, docking: Docking) =>
    dock === null || docking === 'both' || orientationOf(dock) === docking;

const KEYBOARD_MOVE_STEP_PX = 10;
/** The smallest a panel is resized to: room for a few rows under its header. */
const MIN_PANEL_SIZE = { width: 160, height: 80 };
const UNMEASURED_PANEL_SIZE = { width: 320, height: 200 };
const SCREEN_COORDINATE_SCALE = 1;

interface DockablePanelProps {
    id: string;
    title: string;
    children: ReactNode;
    /** Top/bottom are horizontal; side and corner docks are vertical. Floating is always allowed. */
    docking?: Docking;
    /** Optional alternate content for top/bottom docks; children is the vertical/floating view. */
    horizontalView?: ReactNode;
}

interface Drag {
    id: string;
    pointerId: number;
    start: { x: number; y: number };
    moved: boolean;
    position: { x: number; y: number };
    offset: { x: number; y: number };
    dock: Dock;
    title: string;
    docking: Docking;
}

/** The bottom corner of a panel a resize drags. */
type Corner = 'left' | 'right';

interface Resize {
    id: string;
    pointerId: number;
    corner: Corner;
    start: { x: number; y: number };
    /** The panel's box when the drag began. */
    from: { x: number; y: number; width: number; height: number };
    size: { width: number; height?: number };
    position: { x: number; y: number };
    /** Whether the pointer went beyond a click's slip, so the release resizes. */
    moved: boolean;
}

/** The corners a panel can be resized by: the one away from the edge it is docked to. */
const RESIZE_CORNERS: Record<Exclude<Dock, null> | 'floating', Corner[]> = {
    'top-left': ['right'],
    left: ['right'],
    'bottom-left': ['right'],
    'top-right': ['left'],
    right: ['left'],
    'bottom-right': ['left'],
    top: ['left', 'right'],
    bottom: ['left', 'right'],
    floating: ['left', 'right']
};

const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), Math.max(min, max));

export const DockablePanel: FC<DockablePanelProps> = () => null;

const zoneAt = (x: number, y: number, sideWidth: number, gap: number): Dock => {
    const zoneHeight = EDGE_ZONE_HEIGHT_PX;
    const bottom = window.innerHeight - STATUS_BAR_HEIGHT_PX;
    const leftEnd = sideWidth;
    const rightStart = window.innerWidth - sideWidth;
    const topEnd = zoneHeight;
    const bottomStart = bottom - zoneHeight;

    if (x < 0 || x > window.innerWidth || y < 0 || y > bottom) return null;
    if (x <= leftEnd && y < topEnd) return 'top-left';
    if (x <= leftEnd && y >= bottomStart) return 'bottom-left';
    if (x >= rightStart && y < topEnd) return 'top-right';
    if (x >= rightStart && y >= bottomStart) {
        return 'bottom-right';
    }
    if (x <= leftEnd && y >= zoneHeight + gap && y < bottomStart - gap) {
        return 'left';
    }
    if (x >= rightStart && y >= zoneHeight + gap && y < bottomStart - gap) {
        return 'right';
    }
    if (y < topEnd && x > leftEnd + gap && x < rightStart - gap) {
        return 'top';
    }
    if (y >= bottomStart && x > leftEnd + gap && x < rightStart - gap) {
        return 'bottom';
    }

    return null;
};

const DOCK_ZONES: Array<{ dock: DockZone; className: string; label: string }> = [
    { dock: 'top-left', className: 'zoneTopLeft', label: 'Top left' },
    { dock: 'left', className: 'zoneLeft', label: 'Left' },
    { dock: 'bottom-left', className: 'zoneBottomLeft', label: 'Bottom left' },
    { dock: 'top-right', className: 'zoneTopRight', label: 'Top right' },
    { dock: 'right', className: 'zoneRight', label: 'Right' },
    { dock: 'bottom-right', className: 'zoneBottomRight', label: 'Bottom right' },
    { dock: 'top', className: 'zoneTop', label: 'Top' },
    { dock: 'bottom', className: 'zoneBottom', label: 'Bottom' }
];

const DockZones: FC<{ activeDock: Dock | undefined; docking: Docking }> = ({
    activeDock,
    docking
}) => {
    if (activeDock === undefined) return null;

    return (
        <div className={styles.dockZones} aria-hidden="true">
            {DOCK_ZONES.filter(({ dock }) => allowsDock(dock, docking)).map(
                ({ dock, className, label }) => (
                    <div
                        key={dock}
                        className={`${styles.zone} ${styles[className as keyof typeof styles]} ${
                            dock === activeDock ? styles.activeZone : ''
                        }`}
                        data-zone={dock}
                        title={label}
                    />
                )
            )}
        </div>
    );
};

export const PanelLayout: FC<{ children: ReactNode }> = ({ children }) => {
    const panelLayout = usePanelLayout();
    const controls = useControls();
    const { setPanelPlacement } = useActions();
    const [drag, setDrag] = useState<Drag>();
    const [resize, setResize] = useState<Resize>();
    const [viewport, setViewport] = useState({
        width: window.innerWidth,
        height: window.innerHeight
    });
    const [sizes, setSizes] = useState<Record<string, { width: number; height: number }>>({});
    const handle = useRef<HTMLButtonElement>(null);
    const panelLayer = useRef<HTMLDivElement>(null);
    const pendingFocus = useRef<string | null>(null);
    const dockAtPointer = (x: number, y: number, docking: Docking) => {
        // Read the rendered column so hit testing follows the panel-width token and viewport cap.
        const sideDock = panelLayer.current?.querySelector('[data-dock="left"]');
        if (!sideDock) {
            return null;
        }
        const width = sideDock.getBoundingClientRect().width;
        const gap = Number.parseFloat(getComputedStyle(sideDock).rowGap);
        const dock = zoneAt(x, y, width, gap);

        return allowsDock(dock, docking) ? dock : null;
    };
    const panelDock = ({ props }: ReactElement<DockablePanelProps>): Dock => {
        const dock = panelLayout[props.id]?.dock ?? null;

        // Old saved placements can predate a panel's docking restrictions.
        return allowsDock(dock, props.docking ?? 'both') ? dock : null;
    };

    useEffect(() => {
        const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', resize);

        return () => window.removeEventListener('resize', resize);
    }, []);

    useEffect(() => {
        if (!drag) return;

        const cancel = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopImmediatePropagation();
            handle.current?.releasePointerCapture(drag.pointerId);
            setDrag(undefined);
        };

        const reset = () => setDrag(undefined);
        window.addEventListener('keydown', cancel, true);
        window.addEventListener('blur', reset);
        window.addEventListener('contextmenu', reset, true);

        return () => {
            window.removeEventListener('keydown', cancel, true);
            window.removeEventListener('blur', reset);
            window.removeEventListener('contextmenu', reset, true);
        };
    }, [drag]);

    useEffect(() => {
        if (!resize) return;

        const cancel = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopImmediatePropagation();
            setResize(undefined);
        };
        const reset = () => setResize(undefined);

        window.addEventListener('keydown', cancel, true);
        window.addEventListener('blur', reset);

        return () => {
            window.removeEventListener('keydown', cancel, true);
            window.removeEventListener('blur', reset);
        };
    }, [resize]);

    const panels = Children.toArray(children) as Array<ReactElement<DockablePanelProps>>;
    const visiblePanels = panels.filter(
        ({ props }) => controls[props.id as keyof typeof controls]?.visible ?? props.id === 'stats'
    );
    const visiblePanelLocations = visiblePanels
        .map((panel) => `${panel.props.id}:${panelDock(panel) ?? 'floating'}`)
        .join('|');

    useLayoutEffect(() => {
        if (!pendingFocus.current) return;
        panelLayer.current
            ?.querySelector<HTMLButtonElement>(`[data-panel="${pendingFocus.current}"] > button`)
            ?.focus({ preventScroll: true });
        pendingFocus.current = null;
    }, [visiblePanelLocations]);

    useEffect(() => {
        const layer = panelLayer.current;

        if (!layer) return;

        const observers: ResizeObserver[] = [];
        const updateSize = (id: string, width: number, height: number) => {
            setSizes((current) =>
                current[id]?.width === width && current[id]?.height === height
                    ? current
                    : { ...current, [id]: { width, height } }
            );
        };

        layer.querySelectorAll<HTMLElement>('[data-panel]').forEach((node) => {
            const id = node.dataset.panel;

            if (!id) return;

            const bounds = node.getBoundingClientRect();
            updateSize(id, bounds.width, bounds.height);

            if (typeof ResizeObserver === 'undefined') return;

            const observer = new ResizeObserver(([entry]) => {
                updateSize(id, entry.contentRect.width, entry.contentRect.height);
            });
            observer.observe(node);
            observers.push(observer);
        });

        return () => observers.forEach((observer) => observer.disconnect());
    }, [visiblePanelLocations]);
    const renderPanel = (panel: ReactElement<DockablePanelProps>, dock: Dock) => {
        const { id, title, children, horizontalView, docking = 'both' } = panel.props;
        const orientation = orientationOf(dock);
        const content = orientation === 'horizontal' ? (horizontalView ?? children) : children;
        const placement = panelLayout[id] ?? { dock: null, position: { x: 0, y: 0 } };
        const floating = !dock;
        const size = sizes[id] ?? UNMEASURED_PANEL_SIZE;
        const maxX = Math.max(0, viewport.width - size.width);
        const maxY = Math.max(0, viewport.height - size.height);
        const position = {
            x: Math.max(0, Math.min(placement.position.x, maxX)),
            y: Math.max(0, Math.min(placement.position.y, maxY))
        };
        const isDragging = drag?.id === id;
        const resizing = resize?.id === id ? resize : undefined;
        const chosenSize = resizing?.size ?? placement.size;
        const shownPosition = resizing?.position ?? position;
        const place = (next: Omit<PanelPlacement, 'size'>) =>
            setPanelPlacement({
                id,
                placement: placement.size ? { ...next, size: placement.size } : next
            });
        const placeWithKeyboard = (next: PanelPlacement) => {
            if (!allowsDock(next.dock, docking)) {
                return;
            }
            if (next.dock !== dock) {
                pendingFocus.current = id;
            }
            place(next);
        };
        /** The box a corner dragged by `dx`, `dy` from `from` leaves the panel. */
        const resized = (corner: Corner, from: Resize['from'], dx: number, dy: number) => {
            const width = clamp(
                from.width + (corner === 'right' ? dx : -dx),
                MIN_PANEL_SIZE.width,
                floating
                    ? corner === 'right'
                        ? viewport.width - from.x
                        : from.x + from.width
                    : viewport.width
            );
            // The height is chosen only once the corner moves up or down, so widening a
            // panel leaves it growing with its content.
            const height = beyondClickSlip({ x: 0, y: 0 }, { x: 0, y: dy }, SCREEN_COORDINATE_SCALE)
                ? clamp(from.height + dy, MIN_PANEL_SIZE.height, viewport.height - from.y)
                : placement.size?.height;

            return {
                size: height === undefined ? { width } : { width, height },
                position: {
                    x: floating && corner === 'left' ? from.x + from.width - width : position.x,
                    y: position.y
                }
            };
        };
        const resizeTo = (next: ReturnType<typeof resized>) =>
            setPanelPlacement({
                id,
                placement: {
                    ...placement,
                    position: floating ? next.position : placement.position,
                    size: next.size
                }
            });
        const panelBox = (element: Element) => {
            const bounds = element.closest('[data-panel]')?.getBoundingClientRect();

            return (
                bounds && {
                    x: bounds.left,
                    y: bounds.top,
                    width: bounds.width,
                    height: bounds.height
                }
            );
        };
        const restoreSize = () =>
            setPanelPlacement({ id, placement: { dock: placement.dock, position } });

        const grip = (corner: Corner) => (
            <button
                key={corner}
                type="button"
                className={`${styles.grip} ${corner === 'left' ? styles.gripLeft : styles.gripRight}`}
                aria-label={`Resize ${title}. Use arrow keys to resize, Delete to restore the default size.`}
                onPointerDown={(event) => {
                    const from = panelBox(event.currentTarget);

                    if (event.button !== 0 || drag || resize || !from) return;
                    event.preventDefault();
                    event.stopPropagation();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setResize({
                        id,
                        pointerId: event.pointerId,
                        corner,
                        start: { x: event.clientX, y: event.clientY },
                        from,
                        size: { width: from.width, height: from.height },
                        position: { x: from.x, y: from.y },
                        moved: false
                    });
                }}
                onPointerMove={(event) => {
                    if (!resizing || resizing.pointerId !== event.pointerId) return;
                    event.preventDefault();
                    if (
                        !resizing.moved &&
                        !beyondClickSlip(
                            resizing.start,
                            { x: event.clientX, y: event.clientY },
                            SCREEN_COORDINATE_SCALE
                        )
                    )
                        return;
                    setResize({
                        ...resizing,
                        moved: true,
                        ...resized(
                            corner,
                            resizing.from,
                            event.clientX - resizing.start.x,
                            event.clientY - resizing.start.y
                        )
                    });
                }}
                onPointerUp={(event) => {
                    if (!resizing || resizing.pointerId !== event.pointerId) return;
                    event.preventDefault();
                    event.stopPropagation();
                    if (resizing.moved) resizeTo(resizing);
                    setResize(undefined);
                }}
                onPointerCancel={() => setResize(undefined)}
                onLostPointerCapture={() => setResize(undefined)}
                onDoubleClick={restoreSize}
                onKeyDown={(event) => {
                    const step = {
                        ArrowLeft: { dx: -KEYBOARD_MOVE_STEP_PX, dy: 0 },
                        ArrowRight: { dx: KEYBOARD_MOVE_STEP_PX, dy: 0 },
                        ArrowUp: { dx: 0, dy: -KEYBOARD_MOVE_STEP_PX },
                        ArrowDown: { dx: 0, dy: KEYBOARD_MOVE_STEP_PX }
                    }[event.key];

                    if (event.key === 'Delete' || event.key === 'Backspace') {
                        event.preventDefault();
                        event.stopPropagation();
                        restoreSize();
                        return;
                    }

                    const from = panelBox(event.currentTarget);

                    if (!step || !from) return;
                    event.preventDefault();
                    event.stopPropagation();
                    // The arrow keys say which way the panel grows, whichever corner has focus.
                    resizeTo(resized('right', from, step.dx, step.dy));
                }}
            />
        );

        const begin = (event: PointerEvent<HTMLButtonElement>) => {
            if (event.button !== 0 || drag) return;
            const bounds = event.currentTarget.closest('[data-panel]')?.getBoundingClientRect();
            if (!bounds) return;
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            handle.current = event.currentTarget;
            setDrag({
                id,
                pointerId: event.pointerId,
                start: { x: event.clientX, y: event.clientY },
                moved: false,
                title,
                docking,
                position: { x: bounds.left, y: bounds.top },
                offset: { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
                dock: dockAtPointer(event.clientX, event.clientY, docking)
            });
        };

        const move = (event: PointerEvent<HTMLButtonElement>) => {
            if (!isDragging || drag.pointerId !== event.pointerId) return;
            event.preventDefault();
            if (
                !drag.moved &&
                !beyondClickSlip(
                    drag.start,
                    { x: event.clientX, y: event.clientY },
                    SCREEN_COORDINATE_SCALE
                )
            )
                return;
            setDrag({
                ...drag,
                moved: true,
                position: {
                    x: Math.max(0, Math.min(event.clientX - drag.offset.x, maxX)),
                    y: Math.max(0, Math.min(event.clientY - drag.offset.y, maxY))
                },
                dock: dockAtPointer(event.clientX, event.clientY, docking)
            });
        };

        const finish = (event: PointerEvent<HTMLButtonElement>) => {
            if (!isDragging || drag.pointerId !== event.pointerId) return;
            event.preventDefault();
            event.stopPropagation();
            if (
                !drag.moved &&
                !beyondClickSlip(
                    drag.start,
                    { x: event.clientX, y: event.clientY },
                    SCREEN_COORDINATE_SCALE
                )
            ) {
                setDrag(undefined);
                return;
            }
            const nextDock = dockAtPointer(event.clientX, event.clientY, docking);
            place({
                dock: nextDock,
                position: {
                    x: Math.max(0, Math.min(event.clientX - drag.offset.x, maxX)),
                    y: Math.max(0, Math.min(event.clientY - drag.offset.y, maxY))
                }
            });
            setDrag(undefined);
        };

        return (
            <section
                key={id}
                className={`${styles.panel} ${floating ? styles.floating : styles.docked} ${
                    isDragging && drag.moved ? styles.dragSource : ''
                } ${id === 'sideBar' ? styles.sideBarPanel : ''}`}
                data-panel={id}
                data-orientation={orientation}
                style={{
                    ...(floating ? { left: shownPosition.x, top: shownPosition.y } : {}),
                    // A size chosen on a larger window shrinks to fit this one.
                    ...(chosenSize
                        ? {
                              width: Math.min(chosenSize.width, viewport.width),
                              maxWidth: 'none'
                          }
                        : {}),
                    ...(chosenSize?.height === undefined
                        ? {}
                        : {
                              height: Math.min(
                                  chosenSize.height,
                                  viewport.height - STATUS_BAR_HEIGHT_PX
                              ),
                              maxHeight: 'none'
                          })
                }}
            >
                <button
                    className={styles.handle}
                    type="button"
                    aria-label={`Move ${title}. Use arrow keys to move, Shift and arrow keys to dock, Enter to float.`}
                    title={id === 'sideBar' ? title : undefined}
                    onPointerDown={begin}
                    onPointerMove={move}
                    onPointerUp={finish}
                    onPointerCancel={() => setDrag(undefined)}
                    onLostPointerCapture={() => setDrag(undefined)}
                    onKeyDown={(event) => {
                        if (
                            ![
                                'ArrowUp',
                                'ArrowDown',
                                'ArrowLeft',
                                'ArrowRight',
                                'Enter',
                                'Escape'
                            ].includes(event.key)
                        )
                            return;
                        event.stopPropagation();
                        if (event.key === 'Escape') {
                            if (!drag) return;
                            event.preventDefault();
                            setDrag(undefined);
                            return;
                        }
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            placeWithKeyboard({ dock: null, position });
                            return;
                        }
                        if (event.key.startsWith('Arrow')) {
                            event.preventDefault();
                            if (event.shiftKey) {
                                const dock =
                                    event.key === 'ArrowLeft'
                                        ? 'left'
                                        : event.key === 'ArrowRight'
                                          ? 'right'
                                          : event.key === 'ArrowUp'
                                            ? 'top'
                                            : 'bottom';
                                placeWithKeyboard({ ...placement, dock });
                                return;
                            }
                            const x =
                                position.x +
                                (event.key === 'ArrowLeft'
                                    ? -KEYBOARD_MOVE_STEP_PX
                                    : event.key === 'ArrowRight'
                                      ? KEYBOARD_MOVE_STEP_PX
                                      : 0);
                            const y =
                                position.y +
                                (event.key === 'ArrowUp'
                                    ? -KEYBOARD_MOVE_STEP_PX
                                    : event.key === 'ArrowDown'
                                      ? KEYBOARD_MOVE_STEP_PX
                                      : 0);
                            placeWithKeyboard({ dock: null, position: { x, y } });
                        }
                    }}
                >
                    {id === 'sideBar' ? <span aria-hidden="true">☰</span> : title}
                </button>
                <div className={styles.content}>{content}</div>
                <div className={styles.grips}>{RESIZE_CORNERS[dock ?? 'floating'].map(grip)}</div>
            </section>
        );
    };

    const docked = (dock: DockZone) => {
        const panels = visiblePanels.filter((panel) => panelDock(panel) === dock);

        return (
            <div
                className={styles.dock}
                data-dock={dock}
                style={{
                    minHeight: `calc(${panels.length} * var(--panel-header-height) + ${Math.max(0, panels.length - 1)} * var(--panel-gap))`
                }}
            >
                {panels.map((panel) => renderPanel(panel, dock))}
            </div>
        );
    };

    const floats = visiblePanels
        .filter((panel) => panelDock(panel) === null)
        .map((panel) => renderPanel(panel, null));

    return (
        <div className={styles.panelLayer} ref={panelLayer} style={DOCK_GEOMETRY_STYLE}>
            <DockZones
                activeDock={drag?.moved ? drag.dock : undefined}
                docking={drag?.docking ?? 'both'}
            />
            <div className={`${styles.column} ${styles.leftColumn}`}>
                {docked('top-left')}
                <div className={styles.spacer} />
                {docked('left')}
                <div className={styles.spacer} />
                {docked('bottom-left')}
            </div>
            <div className={`${styles.column} ${styles.rightColumn}`}>
                {docked('top-right')}
                <div className={styles.spacer} />
                {docked('right')}
                <div className={styles.spacer} />
                {docked('bottom-right')}
            </div>
            <div className={`${styles.column} ${styles.centerColumn}`}>
                {docked('top')}
                <div className={styles.spacer} />
                {docked('bottom')}
            </div>
            {floats}
            {drag?.moved && (
                <div
                    className={styles.dragPreview}
                    style={{ left: drag.position.x, top: drag.position.y }}
                    aria-hidden="true"
                >
                    {drag.title}
                    {drag.dock && (
                        <span>Dock {DOCK_ZONES.find(({ dock }) => dock === drag.dock)?.label}</span>
                    )}
                </div>
            )}
        </div>
    );
};
