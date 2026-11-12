import React, { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
/** A press that moves less than this selects the screen; more drags its card. */
const DRAG_SLIP = 3;

const EFFECT_ICONS: Partial<Record<Effect['kind'], typeof Eye>> = {
    variant: Replace,
    toggleVisibility: Eye,
    setState: ToggleRight,
    toggleState: ToggleRight
};

/** ↑ and ↓ walk a card's rows, as in a list. */
function walkRows(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
        return;
    }
    const rows = [
        ...(event.currentTarget.closest('ul')?.querySelectorAll<HTMLElement>('li > button') ?? [])
    ];
    const next = rows[rows.indexOf(event.currentTarget) + (event.key === 'ArrowDown' ? 1 : -1)];
    if (next) {
        event.preventDefault();
        next.focus({ preventScroll: true });
    }
}

const inactiveNote = (transition: Transition) =>
    transition.inactive === 'hidden'
        ? 'Hidden, so never drawn in Preview'
        : transition.inactive === 'unusedVariant'
          ? 'In a variant this instance never draws'
          : undefined;

/** Just under an element, where its menu opens. */
function below(element: Element): Point {
    const box = element.getBoundingClientRect();

    return { x: box.left, y: box.bottom + 4 };
}

/** A card's links, one per row, then Add link. Drawn again only when its own Screen changes. */
const Rows = memo(function Rows({
    state,
    selectedLink,
    onLinkMenu,
    onAddMenu
}: {
    state: FlowState;
    /** The selected link, when it is one of this card's. */
    selectedLink?: string;
    onLinkMenu: (key: string, at: Point) => void;
    onAddMenu: (screenId: string, at: Point) => void;
}) {
    return (
        <ul>
            {state.transitions.map((transition) => {
                const EffectIcon = EFFECT_ICONS[transition.effect.kind];
                const guard = guardText(transition.guard);
                const id = `flow-row-${state.id}-${transition.key}`.replace(/[^\w-]/g, '_');
                const notes = [transition.broken, inactiveNote(transition)]
                    .filter(Boolean)
                    .join('. ');

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
                            onKeyDown={walkRows}
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
                            {sentence(transition)}
                            {notes && `. ${notes}`}
                        </span>
                        {transition.effect.kind === 'go' && (
                            <span className={styles.dot} aria-hidden="true" />
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
                    onKeyDown={walkRows}
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
    onSelect,
    onLinkMenu,
    onAddMenu,
    onScreenMenu,
    onMove
}: {
    machine: Machine;
    layout: FlowLayout;
    links: FlowLink[];
    /** The laid-out document the drawings were made from. */
    document: Document;
    drawings: Map<string, ScreenDrawing>;
    selection?: FlowSelection;
    canArrange: boolean;
    onSelect: (selection?: FlowSelection) => void;
    onLinkMenu: (key: string, at: Point) => void;
    onAddMenu: (screenId: string, at: Point) => void;
    onScreenMenu: (screenId: string, at: Point) => void;
    /** A card dragged or nudged by this much, in the drawing's own units. */
    onMove: (screenId: string, by: Point, done: boolean) => void;
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
        const zoom = Math.max(
            MIN_ZOOM,
            Math.min(1, element.clientWidth / width, element.clientHeight / height)
        );
        apply(
            {
                zoom,
                x: Math.max(0, (element.clientWidth - width * zoom) / 2),
                y: Math.max(0, (element.clientHeight - height * zoom) / 2)
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
    const drag = useRef<{ id: string; pointer: number; origin: Point; moved: boolean } | undefined>(
        undefined
    );
    // The same functions on every render, so a card's rows are not drawn again for nothing.
    const menus = useRef({ onLinkMenu, onAddMenu });
    menus.current = { onLinkMenu, onAddMenu };
    const openLinkMenu = useCallback(
        (key: string, at: Point) => menus.current.onLinkMenu(key, at),
        []
    );
    const openAddMenu = useCallback(
        (screenId: string, at: Point) => menus.current.onAddMenu(screenId, at),
        []
    );
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
                            style={{
                                transform: `translate(${card.x}px, ${card.y}px)`,
                                width: card.width
                            }}
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
                                onClick={() => onSelect({ kind: 'screen', id: state.id })}
                            >
                                {drawing ? (
                                    <ScreenThumbnail
                                        document={document}
                                        drawing={drawing}
                                        label={`Picture of ${state.name}`}
                                        outlined={outlined}
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
                                    aria-describedby={note ? `flow-note-${state.id}` : undefined}
                                    title="Drag to arrange, or use arrow keys. Canvas positions stay unchanged."
                                    onKeyDown={(event) => {
                                        const steps: Record<string, Point> = {
                                            ArrowLeft: { x: -ARROW_STEP, y: 0 },
                                            ArrowRight: { x: ARROW_STEP, y: 0 },
                                            ArrowUp: { x: 0, y: -ARROW_STEP },
                                            ArrowDown: { x: 0, y: ARROW_STEP }
                                        };
                                        const step = steps[event.key];
                                        if (step && canArrange) {
                                            event.preventDefault();
                                            onMove(state.id, step, true);
                                        }
                                    }}
                                    onPointerDown={(event) => {
                                        if (event.button !== 0 || drag.current) {
                                            return;
                                        }
                                        event.currentTarget.setPointerCapture(event.pointerId);
                                        drag.current = {
                                            id: state.id,
                                            pointer: event.pointerId,
                                            origin: { x: event.clientX, y: event.clientY },
                                            moved: false
                                        };
                                    }}
                                    onPointerMove={(event) => {
                                        const active = drag.current;
                                        if (
                                            !active ||
                                            active.pointer !== event.pointerId ||
                                            !canArrange
                                        ) {
                                            return;
                                        }
                                        const by = {
                                            x: event.clientX - active.origin.x,
                                            y: event.clientY - active.origin.y
                                        };
                                        if (
                                            !active.moved &&
                                            Math.abs(by.x) < DRAG_SLIP &&
                                            Math.abs(by.y) < DRAG_SLIP
                                        ) {
                                            return;
                                        }
                                        active.moved = true;
                                        setDragging(active.id);
                                        onMove(
                                            active.id,
                                            {
                                                x: by.x / view.current.zoom,
                                                y: by.y / view.current.zoom
                                            },
                                            false
                                        );
                                    }}
                                    onPointerUp={(event) => {
                                        const active = drag.current;
                                        if (active?.pointer !== event.pointerId) {
                                            return;
                                        }
                                        drag.current = undefined;
                                        setDragging(undefined);
                                        if (active.moved) {
                                            onMove(
                                                active.id,
                                                {
                                                    x:
                                                        (event.clientX - active.origin.x) /
                                                        view.current.zoom,
                                                    y:
                                                        (event.clientY - active.origin.y) /
                                                        view.current.zoom
                                                },
                                                true
                                            );
                                        } else {
                                            onSelect({ kind: 'screen', id: state.id });
                                        }
                                    }}
                                    onPointerCancel={() => {
                                        if (drag.current?.moved) {
                                            onMove(drag.current.id, { x: 0, y: 0 }, true);
                                        }
                                        drag.current = undefined;
                                        setDragging(undefined);
                                    }}
                                >
                                    {isStart && <span className={styles.badge}>Start</span>}
                                    <span className={styles.screenName}>{state.name}</span>
                                </button>
                                <button
                                    className={styles.more}
                                    aria-label={`More for ${state.name}`}
                                    aria-haspopup="menu"
                                    onClick={(event) =>
                                        onScreenMenu(state.id, below(event.currentTarget))
                                    }
                                >
                                    <Icon icon={{ component: MoreHorizontal, size: 16 }} />
                                </button>
                            </h2>
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
                            />
                        </section>
                    );
                })}
            </div>
            {!fitted && (
                <button className={styles.fit} onClick={fit}>
                    Fit
                </button>
            )}
        </div>
    );
}
