import React from 'react';
import { MoreHorizontal, Plus } from 'lucide-react';
import { Icon } from 'src/ui/components/Icon';
import { sentence, type Machine } from 'src/app/flowMachine';
import type { Point } from 'src/app/types';
import { describeRow, rowKeys, walkScreen, type FlowSelection } from './FlowBoard';
import styles from './Flow.css';

const NOWHERE: Point = { x: 0, y: 0 };

/**
 * The map on a narrow window: one group per Screen, in the map's order, each link as a
 * sentence. Menus open as sheets, so where a row sits does not matter to them.
 */
export function FlowList({
    machine,
    order,
    selection,
    canEdit,
    onSelect,
    onLinkMenu,
    onAddMenu,
    onScreenMenu,
    onRemove
}: {
    machine: Machine;
    /** Screen ids as the map lays them out: by column, then down each column. */
    order: readonly string[];
    selection?: FlowSelection;
    canEdit: boolean;
    onSelect: (selection?: FlowSelection) => void;
    onLinkMenu: (key: string, at: Point) => void;
    onAddMenu: (screenId: string, at: Point) => void;
    onScreenMenu: (screenId: string, at: Point) => void;
    onRemove: (key: string) => void;
}) {
    const states = new Map(machine.states.map((state) => [state.id, state]));

    return (
        <div className={styles.list} aria-label="Screen flow" data-flow-list="">
            {order.map((id) => {
                const state = states.get(id);
                if (!state) {
                    return null;
                }
                const note = !state.available
                    ? 'Hidden or inside another screen, so nothing can go here'
                    : !state.reachable
                      ? 'Nothing leads here'
                      : undefined;

                return (
                    <section
                        key={id}
                        className={styles.group}
                        data-flow-screen={id}
                        data-dim={!state.available || !state.reachable}
                        role="group"
                        aria-label={`Screen ${state.name}`}
                    >
                        <h2>
                            <button
                                className={styles.groupName}
                                aria-pressed={selection?.kind === 'screen' && selection.id === id}
                                aria-describedby={note ? `flow-note-${id}` : undefined}
                                data-flow-stop=""
                                onKeyDown={(event) => walkScreen(event, true)}
                                onClick={() => onSelect({ kind: 'screen', id })}
                            >
                                {machine.initial === id && (
                                    <span className={styles.badge}>Start</span>
                                )}
                                <span className={styles.screenName}>{state.name}</span>
                                {note && (
                                    <span id={`flow-note-${id}`} className={styles.groupNote}>
                                        {note}
                                    </span>
                                )}
                            </button>
                            <button
                                className={styles.groupMore}
                                aria-label={`More for ${state.name}`}
                                aria-haspopup="menu"
                                tabIndex={-1}
                                data-flow-stop=""
                                onKeyDown={(event) => walkScreen(event, true)}
                                onClick={() => onScreenMenu(id, NOWHERE)}
                            >
                                <Icon icon={{ component: MoreHorizontal, size: 18 }} />
                            </button>
                        </h2>
                        <ul>
                            {state.transitions.map((transition) => {
                                const describedBy = `flow-row-${id}-${transition.key}`.replace(
                                    /[^\w-]/g,
                                    '_'
                                );
                                const editable =
                                    canEdit && transition.editable && !transition.shared;

                                return (
                                    <li key={transition.key}>
                                        <button
                                            data-flow-control={transition.key}
                                            data-inactive={Boolean(transition.inactive)}
                                            aria-label={transition.control}
                                            aria-describedby={describedBy}
                                            aria-pressed={
                                                selection?.kind === 'link' &&
                                                selection.key === transition.key
                                            }
                                            aria-haspopup="menu"
                                            tabIndex={-1}
                                            data-flow-stop=""
                                            onKeyDown={(event) =>
                                                rowKeys(
                                                    event,
                                                    editable
                                                        ? () => onRemove(transition.key)
                                                        : undefined,
                                                    true
                                                )
                                            }
                                            onClick={() => onLinkMenu(transition.key, NOWHERE)}
                                        >
                                            <span className={styles.sentence}>
                                                {sentence(transition)}
                                            </span>
                                            {transition.broken && (
                                                <span
                                                    className={styles.problem}
                                                    title={transition.broken}
                                                />
                                            )}
                                        </button>
                                        <span id={describedBy} className={styles.hidden}>
                                            {describeRow(transition)}
                                        </span>
                                    </li>
                                );
                            })}
                            <li>
                                <button
                                    className={styles.add}
                                    aria-haspopup="menu"
                                    aria-label={`Add link on ${state.name}`}
                                    data-flow-add={id}
                                    tabIndex={-1}
                                    data-flow-stop=""
                                    onKeyDown={(event) => walkScreen(event, true)}
                                    onClick={() => onAddMenu(id, NOWHERE)}
                                >
                                    <Icon icon={{ component: Plus, size: 16 }} />
                                    Add link
                                </button>
                            </li>
                        </ul>
                    </section>
                );
            })}
        </div>
    );
}
