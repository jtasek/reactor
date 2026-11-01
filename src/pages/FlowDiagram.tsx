import React, { useLayoutEffect, useRef, useState } from 'react';
import type { projectFlow } from 'src/app/flowProjection';
import { useAppState, useEffects } from 'src/app/hooks';
import { readFlowPositions } from './flowPositions';
import type { Point } from 'src/app/types';
import styles from './Flow.css';

type Graph = ReturnType<typeof projectFlow>;

/** Diagram offsets are local UI state, never frame geometry or prototype state. */
export function FlowDiagram({
    graph,
    selected,
    onSelect,
    canConnect,
    onConnect,
    start,
    reachable
}: {
    graph: Graph;
    selected?: string;
    onSelect: (key: string) => void;
    canConnect: boolean;
    onConnect: (id: string) => void;
    start?: string;
    reachable: Set<string>;
}) {
    const board = useRef<HTMLDivElement>(null);
    const effects = useEffects();
    const key = useAppState((state) => `reactor:flow:${state.currentDocumentId}`);
    const [offsets, setOffsets] = useState<Record<string, Point>>(() => {
        try {
            return readFlowPositions(effects.loadState(key));
        } catch {
            return {};
        }
    });
    const [saveFailed, setSaveFailed] = useState(false);
    const save = (positions: Record<string, Point>) => {
        try {
            effects.saveState(key, positions);
            setSaveFailed(false);
        } catch {
            setSaveFailed(true);
        }
    };
    const drag = useRef<{ id: string; pointer: number; origin: Point; offset: Point } | undefined>(
        undefined
    );
    const [lines, setLines] = useState<{ key: string; path: string; selected: boolean }[]>([]);
    useLayoutEffect(() => {
        const element = board.current;
        if (!element) {
            return;
        }
        const measure = () => {
            const origin = element.getBoundingClientRect();
            const nodes = new Map(
                Array.from(element.querySelectorAll<HTMLElement>('[data-flow-screen]')).map(
                    (node) => [node.dataset.flowScreen, node.getBoundingClientRect()]
                )
            );
            setLines(
                graph.flatMap((screen) =>
                    screen.controls.flatMap((control) => {
                        const source = element
                            .querySelector<HTMLElement>(
                                `[data-flow-control="${CSS.escape(control.key)}"]`
                            )
                            ?.getBoundingClientRect();
                        const target = nodes.get(control.target);
                        const sourceNode = nodes.get(screen.id);
                        if (!source || !target || !sourceNode) {
                            return [];
                        }
                        const x = sourceNode.right - origin.left;
                        const y = source.top + source.height / 2 - origin.top;
                        const self = screen.id === control.target;
                        const tx = (self ? target.right : target.left) - origin.left;
                        const ty = target.top + 24 - origin.top;

                        return [
                            {
                                key: control.key,
                                selected: selected === control.key,
                                path: `M ${x} ${y} C ${x + 48} ${y}, ${tx + (self ? 48 : -48)} ${ty}, ${tx} ${ty}`
                            }
                        ];
                    })
                )
            );
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(element);

        return () => observer.disconnect();
    }, [graph, offsets, selected]);
    const move = (id: string, offset: Point, persist = false) => {
        const node = board.current?.querySelector<HTMLElement>(
            `[data-flow-screen="${CSS.escape(id)}"]`
        );
        const next = {
            ...offsets,
            [id]: {
                x: Math.max(8 - (node?.offsetLeft ?? 32), offset.x),
                y: Math.max(8 - (node?.offsetTop ?? 32), offset.y)
            }
        };
        setOffsets(next);
        if (persist) {
            save(next);
        }
    };

    return (
        <div className={styles.diagram} aria-label="Screen flow">
            <p>
                Drag a screen heading to arrange this diagram, or focus it and use arrow keys.
                Arrangement is saved on this device. Canvas positions stay unchanged.
            </p>
            {saveFailed && <p role="status">Arrangement could not be saved on this device.</p>}
            <div className={styles.board} ref={board}>
                <svg className={styles.connections} aria-hidden="true">
                    <defs>
                        <marker
                            id="flow-arrow"
                            viewBox="0 0 10 10"
                            refX="9"
                            refY="5"
                            markerWidth="6"
                            markerHeight="6"
                            orient="auto-start-reverse"
                        >
                            <path d="M 0 0 L 10 5 L 0 10 z" />
                        </marker>
                    </defs>
                    {lines.map((line) => (
                        <path
                            key={line.key}
                            d={line.path}
                            data-selected={line.selected}
                            markerEnd="url(#flow-arrow)"
                        />
                    ))}
                </svg>
                {graph.map((screen) => (
                    <section
                        key={screen.id}
                        className={styles.screen}
                        data-flow-screen={screen.id}
                        style={{
                            transform: `translate(${offsets[screen.id]?.x ?? 0}px, ${offsets[screen.id]?.y ?? 0}px)`
                        }}
                        aria-label={`Screen ${screen.name}`}
                    >
                        <h2>
                            <button
                                className={styles.handle}
                                aria-label={`Arrange ${screen.name}`}
                                onKeyDown={(event) => {
                                    const steps: Record<string, Point> = {
                                        ArrowLeft: { x: -20, y: 0 },
                                        ArrowRight: { x: 20, y: 0 },
                                        ArrowUp: { x: 0, y: -20 },
                                        ArrowDown: { x: 0, y: 20 }
                                    };
                                    const step = steps[event.key];
                                    if (!step) {
                                        return;
                                    }
                                    event.preventDefault();
                                    const offset = offsets[screen.id] ?? { x: 0, y: 0 };
                                    move(
                                        screen.id,
                                        {
                                            x: offset.x + step.x,
                                            y: offset.y + step.y
                                        },
                                        true
                                    );
                                }}
                                onPointerDown={(event) => {
                                    if (event.button !== 0 || drag.current) {
                                        return;
                                    }
                                    event.currentTarget.setPointerCapture(event.pointerId);
                                    drag.current = {
                                        id: screen.id,
                                        pointer: event.pointerId,
                                        origin: { x: event.clientX, y: event.clientY },
                                        offset: offsets[screen.id] ?? { x: 0, y: 0 }
                                    };
                                }}
                                onPointerMove={(event) => {
                                    const active = drag.current;
                                    if (!active || active.pointer !== event.pointerId) {
                                        return;
                                    }
                                    move(active.id, {
                                        x: active.offset.x + event.clientX - active.origin.x,
                                        y: active.offset.y + event.clientY - active.origin.y
                                    });
                                }}
                                onPointerUp={(event) => {
                                    if (drag.current?.pointer !== event.pointerId) {
                                        return;
                                    }
                                    save(offsets);
                                    drag.current = undefined;
                                }}
                                onPointerCancel={() => {
                                    if (drag.current) {
                                        move(drag.current.id, drag.current.offset);
                                    }
                                    drag.current = undefined;
                                }}
                                onLostPointerCapture={() => {
                                    if (drag.current) {
                                        move(drag.current.id, drag.current.offset);
                                    }
                                    drag.current = undefined;
                                }}
                            >
                                {screen.name}
                            </button>
                        </h2>
                        {!screen.available && (
                            <p>Unavailable destination: hidden or nested screen.</p>
                        )}
                        {start && !reachable.has(screen.id) && (
                            <p>Not reachable from the chosen screen.</p>
                        )}
                        <button
                            disabled={!canConnect || !screen.available}
                            onClick={() => onConnect(screen.id)}
                        >
                            Connect to {screen.name}
                        </button>
                        <ul>
                            {screen.controls.map((control) => (
                                <li key={control.key}>
                                    <button
                                        data-flow-control={control.key}
                                        aria-pressed={selected === control.key}
                                        onClick={() => onSelect(control.key)}
                                    >
                                        {control.name}
                                    </button>
                                    <div>
                                        →{' '}
                                        {control.target
                                            ? (graph.find((target) => target.id === control.target)
                                                  ?.name ?? 'Missing screen')
                                            : 'No action'}
                                    </div>
                                    {control.missing && <strong>Unavailable target</strong>}
                                </li>
                            ))}
                        </ul>
                        {!screen.controls.length && <p>No component controls in this screen.</p>}
                    </section>
                ))}
            </div>
        </div>
    );
}
