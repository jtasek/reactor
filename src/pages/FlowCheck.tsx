import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Icon } from 'src/ui/components/Icon';
import type { FlowRef, Machine } from 'src/app/flowMachine';
import type { Point } from 'src/app/types';
import styles from './Flow.css';

/** The one obvious way to put a remark right, when there is one. */
function fixFor(machine: Machine, ref: FlowRef, problem: boolean): string | undefined {
    const state = machine.states.find((item) => item.id === ref.screenId);
    if (problem && ref.key) {
        const link = state?.transitions.find((item) => item.key === ref.key);

        return !link?.editable || link.shared
            ? undefined
            : link.effect.kind === 'go'
              ? 'Pick another screen'
              : 'Change link';
    }
    // A reachable Screen with a remark of its own is one the flow ends on.
    return !ref.key && state?.reachable && state.idle.some((item) => item.editable)
        ? 'Add link'
        : undefined;
}

/**
 * Whether the prototype works as drawn. Broken links are problems and are counted; a
 * Screen nothing leads to, or one the flow ends on, is a note, since that is often meant.
 */
export function FlowCheck({
    machine,
    disabled,
    onStart,
    onShow,
    onFix
}: {
    machine: Machine;
    /** Read-only, locked or mid-gesture: nothing can be changed from here. */
    disabled: boolean;
    onStart: (screenId: string) => void;
    /** Bring what a remark is about into view and select it. */
    onShow: (ref: FlowRef) => void;
    onFix: (ref: FlowRef, at: Point) => void;
}) {
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const count = machine.problems.length;
    const remarks = [
        ...machine.problems.map((ref) => ({ ref, problem: true })),
        ...machine.notes.map((ref) => ({ ref, problem: false }))
    ];

    useEffect(() => {
        if (!open) {
            return;
        }
        const outside = (event: PointerEvent) => {
            if (event.target instanceof Node && !root.current?.contains(event.target)) {
                setOpen(false);
            }
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                // Before the map hears it: this Escape closes the popover and nothing else.
                event.stopPropagation();
                setOpen(false);
                root.current?.querySelector('button')?.focus();
            }
        };
        window.document.addEventListener('pointerdown', outside, true);
        window.document.addEventListener('keydown', escape, true);

        return () => {
            window.document.removeEventListener('pointerdown', outside, true);
            window.document.removeEventListener('keydown', escape, true);
        };
    }, [open]);

    return (
        <div ref={root} className={styles.checkRoot}>
            <button
                className={styles.check}
                data-flow-check={count}
                data-problems={count > 0}
                aria-expanded={open}
                aria-haspopup="dialog"
                aria-label={
                    count === 0 ? 'No problems' : `${count} problem${count === 1 ? '' : 's'}`
                }
                onClick={() => setOpen(!open)}
            >
                {count === 0 ? (
                    <Icon icon={{ component: Check, size: 16 }} />
                ) : (
                    <span className={styles.problem} />
                )}
                <span className={styles.checkCount}>{count > 0 && count}</span>
                <span className={styles.checkLabel}>
                    {count === 0 ? 'No problems' : count === 1 ? 'problem' : 'problems'}
                </span>
            </button>
            {open && (
                <div role="dialog" aria-label="Check" className={styles.checkPanel}>
                    <label>
                        Starts on
                        <select
                            aria-label="Start screen"
                            value={machine.initial ?? ''}
                            disabled={disabled}
                            onChange={(event) => onStart(event.target.value)}
                        >
                            {machine.states
                                .filter((state) => state.available)
                                .map((state) => (
                                    <option key={state.id} value={state.id}>
                                        {state.name}
                                    </option>
                                ))}
                        </select>
                    </label>
                    {remarks.length > 0 && (
                        <ul>
                            {remarks.map(({ ref, problem }) => {
                                const fix = disabled ? undefined : fixFor(machine, ref, problem);

                                return (
                                    <li
                                        key={`${ref.screenId}:${ref.key ?? ''}:${ref.text}`}
                                        data-flow-remark={problem ? 'problem' : 'note'}
                                    >
                                        <span
                                            className={problem ? styles.problem : styles.noteDot}
                                            role="img"
                                            aria-label={problem ? 'Problem' : 'Note'}
                                        />
                                        <button
                                            onClick={() => {
                                                setOpen(false);
                                                onShow(ref);
                                            }}
                                        >
                                            {ref.text}
                                        </button>
                                        {fix && (
                                            <button
                                                className={styles.fix}
                                                onClick={(event) => {
                                                    const box =
                                                        event.currentTarget.getBoundingClientRect();
                                                    setOpen(false);
                                                    onFix(ref, { x: box.left, y: box.bottom + 4 });
                                                }}
                                            >
                                                {fix}
                                            </button>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
