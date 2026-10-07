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
import {
    DOCK_GEOMETRY_STYLE,
    SIDE_ZONE_WIDTH_RATIO,
    SIDE_ZONE_MAX_WIDTH_PX,
    EDGE_ZONE_HEIGHT_RATIO,
    STATUS_BAR_HEIGHT_PX
} from './geometry';

type Dock = PanelPlacement['dock'];
type DockZone = Exclude<Dock, null>;

const KEYBOARD_MOVE_STEP_PX = 10;
const UNMEASURED_PANEL_SIZE = { width: 320, height: 200 };
const SCREEN_COORDINATE_SCALE = 1;

interface DockablePanelProps {
    id: string;
    title: string;
    children: ReactNode;
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
}

export const DockablePanel: FC<DockablePanelProps> = () => null;

const zoneAt = (x: number, y: number): Dock => {
    const sideWidth = Math.min(window.innerWidth * SIDE_ZONE_WIDTH_RATIO, SIDE_ZONE_MAX_WIDTH_PX);
    const zoneHeight = window.innerHeight * EDGE_ZONE_HEIGHT_RATIO;
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
    if (x <= leftEnd && y >= zoneHeight && y < bottomStart) return 'left';
    if (x >= rightStart && y >= zoneHeight && y < bottomStart) return 'right';
    if (y < topEnd && x > sideWidth && x < window.innerWidth - sideWidth) return 'top';
    if (y >= bottomStart && x > sideWidth && x < window.innerWidth - sideWidth) return 'bottom';

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

const DockZones: FC<{ activeDock: Dock | undefined }> = ({ activeDock }) => {
    if (activeDock === undefined) return null;

    return (
        <div className={styles.dockZones} aria-hidden="true">
            {DOCK_ZONES.map(({ dock, className, label }) => (
                <div
                    key={dock}
                    className={`${styles.zone} ${styles[className as keyof typeof styles]} ${
                        dock === activeDock ? styles.activeZone : ''
                    }`}
                    data-zone={dock}
                    title={label}
                />
            ))}
        </div>
    );
};

export const PanelLayout: FC<{ children: ReactNode }> = ({ children }) => {
    const panelLayout = usePanelLayout();
    const controls = useControls();
    const { setPanelPlacement } = useActions();
    const [drag, setDrag] = useState<Drag>();
    const [viewport, setViewport] = useState({
        width: window.innerWidth,
        height: window.innerHeight
    });
    const [sizes, setSizes] = useState<Record<string, { width: number; height: number }>>({});
    const handle = useRef<HTMLButtonElement>(null);
    const panelLayer = useRef<HTMLDivElement>(null);
    const pendingFocus = useRef<string | null>(null);

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

    const panels = Children.toArray(children) as Array<ReactElement<DockablePanelProps>>;
    const visiblePanels = panels.filter(
        ({ props }) => controls[props.id as keyof typeof controls]?.visible ?? props.id === 'stats'
    );
    const visiblePanelLocations = visiblePanels
        .map(({ props }) => `${props.id}:${panelLayout[props.id]?.dock ?? 'floating'}`)
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
        const { id, title, children: content } = panel.props;
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
        const placeWithKeyboard = (next: PanelPlacement) => {
            if (next.dock !== placement.dock) pendingFocus.current = id;
            setPanelPlacement({ id, placement: next });
        };

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
                position: { x: bounds.left, y: bounds.top },
                offset: { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
                dock: zoneAt(event.clientX, event.clientY)
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
                dock: zoneAt(event.clientX, event.clientY)
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
            const nextDock = zoneAt(event.clientX, event.clientY);
            setPanelPlacement({
                id,
                placement: {
                    dock: nextDock,
                    position: {
                        x: Math.max(0, Math.min(event.clientX - drag.offset.x, maxX)),
                        y: Math.max(0, Math.min(event.clientY - drag.offset.y, maxY))
                    }
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
                style={floating ? { left: position.x, top: position.y } : undefined}
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
            </section>
        );
    };

    const docked = (dock: DockZone) => {
        const panels = visiblePanels.filter(({ props }) => panelLayout[props.id]?.dock === dock);

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
        .filter(({ props }) => panelLayout[props.id]?.dock === null || !panelLayout[props.id])
        .map((panel) => renderPanel(panel, null));

    return (
        <div className={styles.panelLayer} ref={panelLayer} style={DOCK_GEOMETRY_STYLE}>
            <DockZones activeDock={drag?.moved ? drag.dock : undefined} />
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
