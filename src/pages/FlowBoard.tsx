import React, {
    memo,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import { Eye, MoreHorizontal, Plus, Replace, ToggleRight } from 'lucide-react';
import { Icon } from 'src/ui/components/Icon';
import {
    ScreenThumbnail,
    type ScreenDrawing
} from 'src/ui/components/DocumentList/DocumentThumbnail';
import {
    effectText,
    guardText,
    sentence,
    type Effect,
    type FlowState,
    type Machine,
    type Transition
} from 'src/app/flowMachine';
import { FLOW, type FlowLayout, type FlowLink } from 'src/app/flowLayout';
import type { Document, Point } from 'src/app/types';
import styles from './Flow.css';

export type FlowSelection = { kind: 'link'; key: string } | { kind: 'screen'; id: string };

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const ARROW_STEP = 20;
/** The floating toolbar's band at the top of the board, which fitting keeps clear. */
const TOOLBAR_BAND = 68;
/** A press that moves less than this selects the screen; more drags its card. */
const DRAG_SLIP = 3;

const EFFECT_ICONS: Partial<Record<Effect['kind'], typeof Eye>> = {
    variant: Replace,
    toggleVisibility: Eye,
    setState: ToggleRight,
    toggleState: ToggleRight
};

/**
 * ↑ and ↓ walk a Screen's name, its menu button and its rows, as in a list. Tab stops once
 * per Screen, on its name, so it steps from Screen to Screen.
 */
export function walkScreen(event: React.KeyboardEvent<HTMLElement>, scroll = false) {
    if ((event.key !== 'ArrowDown' && event.key !== 'ArrowUp') || event.altKey) {
        return;
    }
    const stops = [
        ...(event.currentTarget
            .closest('[data-flow-screen]')
            ?.querySelectorAll<HTMLElement>('[data-flow-stop]') ?? [])
    ];
    const next = stops[stops.indexOf(event.currentTarget) + (event.key === 'ArrowDown' ? 1 : -1)];
    if (next) {
        event.preventDefault();
        next.focus({ preventScroll: !scroll });
    }
}

/** How a screen's name tells the keyboard where its links are: Tab stops only on the name. */
export function keysHint(links: number) {
    return `${links === 0 ? 'No links' : links === 1 ? '1 link' : `${links} links`}. Down arrow moves to the screen's menu and links.`;
}

/** A row's keys: ↑ and ↓ walk, ⌫ removes its link. */
export function rowKeys(
    event: React.KeyboardEvent<HTMLElement>,
    remove?: () => void,
    scroll = false
) {
    if ((event.key === 'Backspace' || event.key === 'Delete') && remove) {
        event.preventDefault();
        remove();

        return;
    }
    walkScreen(event, scroll);
}

export const inactiveNote = (transition: Transition) =>
    transition.inactive === 'hidden'
        ? 'Hidden, so never drawn in Preview'
        : transition.inactive === 'unusedVariant'
          ? 'In a variant this instance never draws'
          : undefined;

/** What a screen reader hears after a row's name: the link in words, then what is wrong. */
export function describeRow(transition: Transition) {
    const notes = [transition.broken, inactiveNote(transition)].filter(Boolean).join('. ');

    return `${sentence(transition)}${notes && `. ${notes}`}`;
}

/** The line that follows the pointer while a link is drawn. */
function liveLine(from: Point, to: Point) {
    const reach = Math.max(40, Math.abs(to.x - from.x) / 2);

    return `M ${from.x} ${from.y} C ${from.x + reach} ${from.y} ${to.x - reach} ${to.y} ${to.x} ${to.y}`;
}

/** Just under an element, where its menu opens. */
function below(element: Element): Point {
    const box = element.getBoundingClientRect();

    return { x: box.left, y: box.bottom + 4 };
}

/** A card's links, one per row, then Add link. Drawn again only when its own Screen changes. */
const Rows = memo(function Rows({
    state,
    selectedLink,
    canConnect,
    onLinkMenu,
    onAddMenu,
    onRemove,
    onLinkStart
}: {
    state: FlowState;
    /** The selected link, when it is one of this card's. */
    selectedLink?: string;
    onLinkMenu: (key: string, at: Point) => void;
    onAddMenu: (screenId: string, at: Point) => void;
    onRemove: (key: string) => void;
    canConnect: boolean;
    /** A press on a row's dot, to drag its link to another Screen. */
    onLinkStart: (event: React.PointerEvent, instanceId: string) => void;
}) {
    return (
        <ul>
            {state.transitions.map((transition) => {
                const EffectIcon = EFFECT_ICONS[transition.effect.kind];
                const guard = guardText(transition.guard);
                const id = `flow-row-${state.id}-${transition.key}`.replace(/[^\w-]/g, '_');
                const editable = canConnect && transition.editable && !transition.shared;

                return (
                    <li key={transition.key}>
                        <button
                            data-flow-control={transition.key}
                            data-inactive={Boolean(transition.inactive)}
                            aria-label={transition.control}
                            aria-describedby={id}
                            aria-pressed={selectedLink === transition.key}
                            aria-haspopup="menu"
                            title={sentence(transition)}
                            tabIndex={-1}
                            data-flow-stop=""
                            onKeyDown={(event) =>
                                rowKeys(
                                    event,
                                    editable ? () => onRemove(transition.key) : undefined
                                )
                            }
                            onClick={(event) => {
                                const box = event.currentTarget.getBoundingClientRect();
                                onLinkMenu(transition.key, {
                                    x: box.right + 10,
                                    y: box.top
                                });
                            }}
                        >
                            {EffectIcon && <Icon icon={{ component: EffectIcon, size: 16 }} />}
                            <span className={styles.control}>{transition.control}</span>
                            <span className={styles.effect}>
                                {effectText(transition.effect)}
                                {guard && ` · ${guard}`}
                            </span>
                            {transition.broken && (
                                <span className={styles.problem} title={transition.broken} />
                            )}
                        </button>
                        <span id={id} className={styles.hidden}>
                            {describeRow(transition)}
                        </span>
                        {transition.effect.kind === 'go' && (
                            <span
                                className={styles.dot}
                                aria-hidden="true"
                                data-flow-dot={transition.key}
                                data-draggable={editable}
                                onPointerDown={
                                    editable
                                        ? (event) => onLinkStart(event, transition.instanceId)
                                        : undefined
                                }
                            />
                        )}
                    </li>
                );
            })}
            <li>
                <button
                    className={styles.add}
                    aria-haspopup="menu"
                    aria-label={`Add link on ${state.name}`}
                    data-flow-add={state.id}
                    tabIndex={-1}
                    data-flow-stop=""
                    onKeyDown={walkScreen}
                    onClick={(event) => onAddMenu(state.id, below(event.currentTarget))}
                >
                    <Icon icon={{ component: Plus, size: 14 }} />
                    Add link
                </button>
            </li>
        </ul>
    );
});

/**
 * The map: one card per Screen with its picture and its links, and the lines between them.
 * Panning and zooming move the whole drawing without rendering it again.
 */
export function FlowBoard({
    machine,
    layout,
    links,
    document,
    drawings,
    selection,
    canArrange,
    canConnect,
    canTidy,
    onSelect,
    onConnect,
    onBoardMenu,
    onLinkMenu,
    onAddMenu,
    onScreenMenu,
    onRemove,
    onMove,
    handle
}: {
    machine: Machine;
    layout: FlowLayout;
    links: FlowLink[];
    /** The laid-out document the drawings were made from. */
    document: Document;
    drawings: Map<string, ScreenDrawing>;
    selection?: FlowSelection;
    canArrange: boolean;
    /** Whether links can be drawn by dragging: not while read-only, locked or mid-gesture. */
    canConnect: boolean;
    /** Whether the board's own menu has anything to offer. */
    canTidy: boolean;
    /** A control dropped on a Screen: it now goes there. */
    onConnect: (instanceId: string, screenId: string) => void;
    onBoardMenu: (at: Point) => void;
    onSelect: (selection?: FlowSelection) => void;
    onLinkMenu: (key: string, at: Point) => void;
    onAddMenu: (screenId: string, at: Point) => void;
    onScreenMenu: (screenId: string, at: Point) => void;
    /** A card dragged or nudged by this much, in the drawing's own units. */
    onMove: (screenId: string, by: Point, done: boolean) => void;
    /** ⌫ on a row: its link goes. */
    onRemove: (key: string) => void;
    /** Filled in with a way to bring a Screen into view. */
    handle: React.MutableRefObject<((screenId: string) => void) | undefined>;
}) {
    const board = useRef<HTMLDivElement>(null);
    const world = useRef<HTMLDivElement>(null);
    const view = useRef({ x: 0, y: 0, zoom: 1 });
    const size = useRef(layout);
    size.current = layout;
    const [fitted, setFitted] = useState(true);
    const isFitted = useRef(true);
    const [dragging, setDragging] = useState<string>();
    const apply = (next: { x: number; y: number; zoom: number }, fit = false) => {
        view.current = next;
        if (world.current) {
            world.current.style.transform = `translate(${next.x}px, ${next.y}px) scale(${next.zoom})`;
        }
        if (board.current) {
            board.current.style.backgroundPosition = `${next.x}px ${next.y}px`;
            board.current.style.backgroundSize = `${20 * next.zoom}px ${20 * next.zoom}px`;
            board.current.dataset.zoom = String(Math.round(next.zoom * 100));
        }
        if (isFitted.current !== fit) {
            isFitted.current = fit;
            setFitted(fit);
        }
    };
    const fit = () => {
        const element = board.current;
        if (!element) {
            return;
        }
        const { width, height } = size.current;
        const room = Math.max(1, element.clientHeight - TOOLBAR_BAND);
        const zoom = Math.max(MIN_ZOOM, Math.min(1, element.clientWidth / width, room / height));
        apply(
            {
                zoom,
                x: Math.max(0, (element.clientWidth - width * zoom) / 2),
                y: TOOLBAR_BAND + Math.max(0, (room - height * zoom) / 2)
            },
            true
        );
    };
    const zoomAt = (factor: number, at?: Point) => {
        const element = board.current;
        if (!element) {
            return;
        }
        const origin = element.getBoundingClientRect();
        const point = at
            ? { x: at.x - origin.left, y: at.y - origin.top }
            : { x: element.clientWidth / 2, y: element.clientHeight / 2 };
        const { x, y, zoom } = view.current;
        const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
        apply({
            zoom: next,
            x: point.x - ((point.x - x) / zoom) * next,
            y: point.y - ((point.y - y) / zoom) * next
        });
    };
    // Pans just far enough that a Screen's card is whole and clear of the toolbar.
    handle.current = (screenId) => {
        const element = board.current;
        const card = layout.cards.find((item) => item.id === screenId);
        if (!element || !card) {
            return;
        }
        const { x, y, zoom } = view.current;
        const edge = 24;
        const box = {
            left: x + card.x * zoom,
            top: y + card.y * zoom,
            right: x + (card.x + card.width) * zoom,
            bottom: y + (card.y + card.height) * zoom
        };
        const shift = (low: number, high: number, from: number, to: number) =>
            high - low > to - from || low < from ? from - low : high > to ? to - high : 0;
        const by = {
            x: shift(box.left, box.right, edge, element.clientWidth - edge),
            y: shift(box.top, box.bottom, TOOLBAR_BAND + edge, element.clientHeight - edge)
        };
        if (by.x || by.y) {
            apply({ zoom, x: x + by.x, y: y + by.y });
        }
    };
    const fitRef = useRef(fit);
    fitRef.current = fit;
    const zoomRef = useRef(zoomAt);
    zoomRef.current = zoomAt;

    // While nobody has moved the view, it keeps showing everything as the drawing grows.
    useLayoutEffect(() => {
        if (isFitted.current) {
            fitRef.current();
        }
    }, [layout.width, layout.height]);
    useEffect(() => {
        const element = board.current;
        if (!element) {
            return;
        }
        const onWheel = (event: WheelEvent) => {
            event.preventDefault();
            if (event.ctrlKey || event.metaKey) {
                zoomRef.current(Math.exp(-event.deltaY / 300), {
                    x: event.clientX,
                    y: event.clientY
                });

                return;
            }
            const { x, y, zoom } = view.current;
            apply({ zoom, x: x - event.deltaX, y: y - event.deltaY });
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (!(event.metaKey || event.ctrlKey) || event.altKey) {
                return;
            }
            if (event.key === '0') {
                event.preventDefault();
                fitRef.current();
            } else if (event.key === '=' || event.key === '+') {
                event.preventDefault();
                zoomRef.current(1.25);
            } else if (event.key === '-') {
                event.preventDefault();
                zoomRef.current(0.8);
            }
        };
        const observer = new ResizeObserver(() => isFitted.current && fitRef.current());
        observer.observe(element);
        element.addEventListener('wheel', onWheel, { passive: false });
        window.addEventListener('keydown', onKeyDown);

        return () => {
            observer.disconnect();
            element.removeEventListener('wheel', onWheel);
            window.removeEventListener('keydown', onKeyDown);
        };
    }, []);

    const pan = useRef<{ pointer: number; origin: Point; x: number; y: number } | undefined>(
        undefined
    );
    // Fingers on a touch screen, so two of them pinch to zoom wherever they land.
    const touches = useRef(new Map<number, Point>());
    const pinch = useRef<
        | { distance: number; middle: Point; view: { x: number; y: number; zoom: number } }
        | undefined
    >(undefined);
    const pinchPoints = () => {
        const [a, b] = [...touches.current.values()];
        const origin = board.current!.getBoundingClientRect();

        return {
            distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
            middle: { x: (a.x + b.x) / 2 - origin.left, y: (a.y + b.y) / 2 - origin.top }
        };
    };
    const touchUp = (event: React.PointerEvent) => {
        if (touches.current.delete(event.pointerId) && touches.current.size < 2) {
            pinch.current = undefined;
        }
    };
    const drag = useRef<{ id: string; pointer: number; origin: Point; moved: boolean } | undefined>(
        undefined
    );
    // The same functions on every render, so a card's rows are not drawn again for nothing.
    const menus = useRef({ onLinkMenu, onAddMenu, onRemove });
    menus.current = { onLinkMenu, onAddMenu, onRemove };
    const removeLink = useCallback((key: string) => menus.current.onRemove(key), []);
    const openLinkMenu = useCallback(
        (key: string, at: Point) => menus.current.onLinkMenu(key, at),
        []
    );
    const openAddMenu = useCallback(
        (screenId: string, at: Point) => menus.current.onAddMenu(screenId, at),
        []
    );
    // A link being drawn: from a control on a picture or from a row's dot, to the pointer.
    const [connecting, setConnecting] = useState<{ from: Point; to: Point; over?: string }>();
    const cancelLink = useRef<(() => void) | undefined>(undefined);
    // A drag ends in a click on what it started on; that click must not select anything.
    const afterDrag = useRef(false);
    const swallowClick = () => {
        afterDrag.current = true;
        setTimeout(() => (afterDrag.current = false));
    };
    const latest = useRef({ onConnect, machine });
    latest.current = { onConnect, machine };
    const startLink = useCallback((event: React.PointerEvent, instanceId: string, at?: Element) => {
        const element = board.current;
        if (event.button !== 0 || !element || cancelLink.current) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        const toWorld = (x: number, y: number): Point => {
            const origin = element.getBoundingClientRect();

            return {
                x: (x - origin.left - view.current.x) / view.current.zoom,
                y: (y - origin.top - view.current.y) / view.current.zoom
            };
        };
        const source = (at ?? event.currentTarget).getBoundingClientRect();
        const from = toWorld(source.left + source.width / 2, source.top + source.height / 2);
        const pointer = event.pointerId;
        const origin = { x: event.clientX, y: event.clientY };
        let moved = false;
        // The available Screen under the pointer, if any.
        const under = (x: number, y: number) => {
            const id = window.document
                .elementFromPoint(x, y)
                ?.closest<HTMLElement>('[data-flow-screen]')?.dataset.flowScreen;

            return latest.current.machine.states.some((state) => state.id === id && state.available)
                ? id
                : undefined;
        };
        const stop = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            window.removeEventListener('pointercancel', stop);
            window.removeEventListener('keydown', key, true);
            cancelLink.current = undefined;
            setConnecting(undefined);
        };
        const move = (next: PointerEvent) => {
            if (next.pointerId !== pointer) {
                return;
            }
            if (
                !moved &&
                Math.abs(next.clientX - origin.x) < DRAG_SLIP &&
                Math.abs(next.clientY - origin.y) < DRAG_SLIP
            ) {
                return;
            }
            moved = true;
            setConnecting({
                from,
                to: toWorld(next.clientX, next.clientY),
                over: under(next.clientX, next.clientY)
            });
        };
        const up = (next: PointerEvent) => {
            if (next.pointerId !== pointer) {
                return;
            }
            const over = moved ? under(next.clientX, next.clientY) : undefined;
            stop();
            if (moved) {
                swallowClick();
            }
            if (over) {
                latest.current.onConnect(instanceId, over);
            }
        };
        const key = (pressed: KeyboardEvent) => {
            if (pressed.key === 'Escape') {
                pressed.preventDefault();
                pressed.stopPropagation();
                stop();
                // The button is still down: its release must not count as a click either.
                window.addEventListener('pointerup', swallowClick, { once: true });
            }
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', stop);
        window.addEventListener('keydown', key, true);
        cancelLink.current = stop;
    }, []);
    useEffect(() => () => cancelLink.current?.(), []);
    // The controls on each picture that can be dragged onto a Screen.
    const connectable = useMemo(
        () =>
            new Map(
                machine.states.map((state) => [
                    state.id,
                    canConnect
                        ? [...state.transitions, ...state.idle]
                              .filter(
                                  (control) =>
                                      control.editable && !('shared' in control && control.shared)
                              )
                              .map((control) => control.instanceId)
                        : []
                ])
            ),
        [machine, canConnect]
    );
    const select = (id: string) => {
        if (!afterDrag.current) {
            onSelect({ kind: 'screen', id });
        }
    };
    // A press on a card's picture or name: on a control it draws a link, elsewhere it moves the card.
    const grip = (event: React.PointerEvent<HTMLElement>, id: string) => {
        if (event.button !== 0 || drag.current || cancelLink.current) {
            return;
        }
        const control = (event.target as Element).closest<SVGElement>('[data-thumbnail-control]');
        if (control) {
            startLink(event, control.dataset.thumbnailControl!, control);

            return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {
            id,
            pointer: event.pointerId,
            origin: { x: event.clientX, y: event.clientY },
            moved: false
        };
    };
    const gripMove = (event: React.PointerEvent) => {
        const active = drag.current;
        if (!active || active.pointer !== event.pointerId || !canArrange) {
            return;
        }
        const by = { x: event.clientX - active.origin.x, y: event.clientY - active.origin.y };
        if (!active.moved && Math.abs(by.x) < DRAG_SLIP && Math.abs(by.y) < DRAG_SLIP) {
            return;
        }
        active.moved = true;
        setDragging(active.id);
        onMove(active.id, { x: by.x / view.current.zoom, y: by.y / view.current.zoom }, false);
    };
    const gripUp = (event: React.PointerEvent) => {
        const active = drag.current;
        if (active?.pointer !== event.pointerId) {
            return;
        }
        drag.current = undefined;
        setDragging(undefined);
        if (active.moved) {
            swallowClick();
            onMove(
                active.id,
                {
                    x: (event.clientX - active.origin.x) / view.current.zoom,
                    y: (event.clientY - active.origin.y) / view.current.zoom
                },
                true
            );
        }
    };
    const gripCancel = () => {
        if (drag.current?.moved) {
            onMove(drag.current.id, { x: 0, y: 0 }, true);
        }
        drag.current = undefined;
        setDragging(undefined);
    };
    const selectedScreen = selection?.kind === 'screen' ? selection.id : undefined;
    const selectedLink = selection?.kind === 'link' ? selection.key : undefined;
    const cards = new Map(layout.cards.map((card) => [card.id, card]));
    const transitions = new Map(
        machine.states.flatMap((state) =>
            state.transitions.map((transition) => [transition.key, transition] as const)
        )
    );
    const start = cards.get(machine.initial ?? '');

    return (
        <div
            ref={board}
            className={styles.board}
            aria-label="Screen flow"
            data-flow-board=""
            onContextMenu={(event) => {
                if (event.target === event.currentTarget && canTidy) {
                    event.preventDefault();
                    onBoardMenu({ x: event.clientX, y: event.clientY });
                }
            }}
            onPointerDownCapture={(event) => {
                if (event.pointerType !== 'touch') {
                    return;
                }
                touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
                if (touches.current.size === 2) {
                    // Two fingers: whatever the first one started gives way to the pinch.
                    cancelLink.current?.();
                    pan.current = undefined;
                    if (drag.current) {
                        if (drag.current.moved) {
                            onMove(drag.current.id, { x: 0, y: 0 }, true);
                        }
                        drag.current = undefined;
                        setDragging(undefined);
                    }
                    pinch.current = { ...pinchPoints(), view: view.current };
                }
            }}
            onPointerMoveCapture={(event) => {
                if (!touches.current.has(event.pointerId)) {
                    return;
                }
                touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
                const start = pinch.current;
                if (!start || touches.current.size !== 2) {
                    return;
                }
                const { distance, middle } = pinchPoints();
                const zoom = Math.max(
                    MIN_ZOOM,
                    Math.min(MAX_ZOOM, (start.view.zoom * distance) / start.distance)
                );
                // The point first under the fingers stays under them.
                apply({
                    zoom,
                    x: middle.x - ((start.middle.x - start.view.x) / start.view.zoom) * zoom,
                    y: middle.y - ((start.middle.y - start.view.y) / start.view.zoom) * zoom
                });
            }}
            onPointerUpCapture={touchUp}
            onPointerCancelCapture={touchUp}
            onPointerDown={(event) => {
                if (event.button !== 0 || event.target !== event.currentTarget) {
                    return;
                }
                event.currentTarget.setPointerCapture(event.pointerId);
                pan.current = {
                    pointer: event.pointerId,
                    origin: { x: event.clientX, y: event.clientY },
                    x: view.current.x,
                    y: view.current.y
                };
            }}
            onPointerMove={(event) => {
                const active = pan.current;
                if (active?.pointer === event.pointerId) {
                    apply({
                        zoom: view.current.zoom,
                        x: active.x + event.clientX - active.origin.x,
                        y: active.y + event.clientY - active.origin.y
                    });
                }
            }}
            onPointerUp={(event) => {
                const active = pan.current;
                if (active?.pointer !== event.pointerId) {
                    return;
                }
                pan.current = undefined;
                // A press that went nowhere is a click on empty board.
                if (
                    Math.abs(event.clientX - active.origin.x) < DRAG_SLIP &&
                    Math.abs(event.clientY - active.origin.y) < DRAG_SLIP
                ) {
                    onSelect(undefined);
                }
            }}
            onPointerCancel={() => {
                pan.current = undefined;
            }}
        >
            <div
                ref={world}
                className={styles.world}
                style={
                    {
                        width: layout.width,
                        height: layout.height,
                        // The layout's own measures, so the drawing cannot drift from the lines.
                        '--flow-thumb': `${FLOW.thumbHeight}px`,
                        '--flow-name': `${FLOW.nameHeight}px`,
                        '--flow-row': `${FLOW.rowHeight}px`
                    } as React.CSSProperties
                }
            >
                <svg
                    className={styles.connections}
                    width={layout.width}
                    height={layout.height}
                    aria-hidden="true"
                >
                    <defs>
                        <marker
                            id="flow-arrow"
                            viewBox="0 0 10 10"
                            refX="9"
                            refY="5"
                            markerWidth="7"
                            markerHeight="7"
                            orient="auto"
                        >
                            <path d="M 0 1 L 9 5 L 0 9 z" fill="context-stroke" />
                        </marker>
                    </defs>
                    {start && (
                        <g className={styles.startMark} data-flow-start={start.id}>
                            <circle cx={start.x - 44} cy={start.y + FLOW.thumbHeight - 14} r={5} />
                            <path
                                d={`M ${start.x - 39} ${start.y + FLOW.thumbHeight - 14} L ${start.x - 2} ${start.y + FLOW.thumbHeight - 14}`}
                                markerEnd="url(#flow-arrow)"
                            />
                        </g>
                    )}
                    {links.map((link) => {
                        const transition = transitions.get(link.key);

                        return (
                            <path
                                key={link.key}
                                d={link.path}
                                data-flow-link={link.key}
                                data-selected={
                                    selectedLink === link.key ||
                                    selectedScreen === link.from ||
                                    selectedScreen === link.to
                                }
                                data-guarded={Boolean(transition?.guard)}
                                data-inactive={Boolean(transition?.inactive)}
                                markerEnd="url(#flow-arrow)"
                            />
                        );
                    })}
                </svg>
                {machine.states.map((state) => {
                    const card = cards.get(state.id);
                    if (!card) {
                        return null;
                    }
                    const drawing = drawings.get(state.id);
                    const outlined = state.transitions.find(
                        (transition) => transition.key === selectedLink
                    )?.instanceId;
                    const isStart = machine.initial === state.id;
                    const note = !state.available
                        ? 'Hidden or inside another screen, so nothing can go here'
                        : !state.reachable
                          ? 'Nothing leads here'
                          : undefined;

                    return (
                        <section
                            key={state.id}
                            className={styles.screen}
                            data-flow-screen={state.id}
                            data-selected={selectedScreen === state.id}
                            data-dim={!state.available || !state.reachable}
                            data-dragging={dragging === state.id}
                            data-drop={
                                connecting
                                    ? connecting.over === state.id
                                        ? 'over'
                                        : state.available
                                          ? 'can'
                                          : undefined
                                    : undefined
                            }
                            style={{
                                transform: `translate(${card.x}px, ${card.y}px)`,
                                width: card.width
                            }}
                            role="group"
                            aria-label={`Screen ${state.name}`}
                        >
                            {/* A pointer shortcut; the name below is the keyboard's way in. */}
                            <button
                                className={styles.thumb}
                                tabIndex={-1}
                                aria-label={`Select ${state.name}`}
                                onContextMenu={(event) => {
                                    event.preventDefault();
                                    onScreenMenu(state.id, { x: event.clientX, y: event.clientY });
                                }}
                                onClick={() => select(state.id)}
                                onPointerDown={(event) => grip(event, state.id)}
                                onPointerMove={gripMove}
                                onPointerUp={gripUp}
                                onPointerCancel={gripCancel}
                            >
                                {drawing ? (
                                    <ScreenThumbnail
                                        document={document}
                                        drawing={drawing}
                                        label={`Picture of ${state.name}`}
                                        outlined={outlined}
                                        controls={connectable.get(state.id)}
                                    />
                                ) : (
                                    <span>No picture</span>
                                )}
                            </button>
                            <h2 className={styles.name}>
                                <button
                                    className={styles.handle}
                                    aria-label={`Arrange ${state.name}`}
                                    onContextMenu={(event) => {
                                        event.preventDefault();
                                        onScreenMenu(state.id, {
                                            x: event.clientX,
                                            y: event.clientY
                                        });
                                    }}
                                    aria-describedby={[
                                        note && `flow-note-${state.id}`,
                                        `flow-keys-${state.id}`
                                    ]
                                        .filter(Boolean)
                                        .join(' ')}
                                    title="Drag to arrange, or hold Alt/⌥ and press the arrow keys. Down arrow moves to the links. Canvas positions stay unchanged."
                                    data-flow-stop=""
                                    onKeyDown={(event) => {
                                        walkScreen(event);
                                        const steps: Record<string, Point> = {
                                            ArrowLeft: { x: -ARROW_STEP, y: 0 },
                                            ArrowRight: { x: ARROW_STEP, y: 0 },
                                            ArrowUp: { x: 0, y: -ARROW_STEP },
                                            ArrowDown: { x: 0, y: ARROW_STEP }
                                        };
                                        const step = steps[event.key];
                                        if (step && event.altKey && canArrange) {
                                            event.preventDefault();
                                            onMove(state.id, step, true);
                                        }
                                    }}
                                    onClick={() => select(state.id)}
                                    onPointerDown={(event) => grip(event, state.id)}
                                    onPointerMove={gripMove}
                                    onPointerUp={gripUp}
                                    onPointerCancel={gripCancel}
                                >
                                    {isStart && <span className={styles.badge}>Start</span>}
                                    <span className={styles.screenName}>{state.name}</span>
                                </button>
                                <button
                                    className={styles.more}
                                    aria-label={`More for ${state.name}`}
                                    aria-haspopup="menu"
                                    tabIndex={-1}
                                    data-flow-stop=""
                                    onKeyDown={walkScreen}
                                    onClick={(event) =>
                                        onScreenMenu(state.id, below(event.currentTarget))
                                    }
                                >
                                    <Icon icon={{ component: MoreHorizontal, size: 16 }} />
                                </button>
                            </h2>
                            <span id={`flow-keys-${state.id}`} className={styles.hidden}>
                                {keysHint(state.transitions.length)}
                            </span>
                            {note && (
                                <span id={`flow-note-${state.id}`} className={styles.hidden}>
                                    {note}
                                </span>
                            )}
                            <Rows
                                state={state}
                                selectedLink={
                                    state.transitions.some(
                                        (transition) => transition.key === selectedLink
                                    )
                                        ? selectedLink
                                        : undefined
                                }
                                onLinkMenu={openLinkMenu}
                                onAddMenu={openAddMenu}
                                onRemove={removeLink}
                                canConnect={canConnect}
                                onLinkStart={startLink}
                            />
                        </section>
                    );
                })}
                {connecting && (
                    // Over the cards, so the line stays whole all the way to the pointer.
                    <svg
                        className={styles.connections}
                        width={layout.width}
                        height={layout.height}
                        aria-hidden="true"
                    >
                        <path
                            className={styles.live}
                            data-flow-live=""
                            d={liveLine(connecting.from, connecting.to)}
                            markerEnd="url(#flow-arrow)"
                        />
                    </svg>
                )}
            </div>
            {!fitted && (
                <button className={styles.fit} onClick={fit}>
                    Fit
                </button>
            )}
        </div>
    );
}
