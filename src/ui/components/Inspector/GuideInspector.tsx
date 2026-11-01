import React, { useEffect, useRef, useState } from 'react';
import { Lock, LockOpen, Ruler } from 'lucide-react';
import { useActions, useAppState } from 'src/app/hooks';
import { isReadOnly } from 'src/app/documentAccess';
import type { Orientation } from 'src/app/types';
import { Icon } from '../Icon';
import { PropertyGroup } from './PropertyGroup';
import styles from './styles.css';

function GuideField({
    label,
    value,
    disabled,
    commit
}: {
    label: string;
    value: string | number;
    disabled: boolean;
    commit: (value: string) => void;
}) {
    const [draft, setDraft] = useState(String(value));
    const input = useRef<HTMLInputElement>(null);
    const latest = useRef({ draft, value, commit });
    latest.current = { draft, value, commit };
    useEffect(() => setDraft(String(value)), [value]);

    // A press elsewhere starts its gesture before this field blurs, and guide edits wait
    // for gestures to end, so the draft is saved when the press begins instead.
    useEffect(() => {
        const onPress = (event: PointerEvent) => {
            const field = input.current;
            if (
                !field ||
                document.activeElement !== field ||
                field.contains(event.target as Node)
            ) {
                return;
            }
            const { draft: typed, value: shown, commit: save } = latest.current;
            if (typed !== String(shown)) {
                save(typed);
            }
        };
        window.addEventListener('pointerdown', onPress, true);

        return () => window.removeEventListener('pointerdown', onPress, true);
    }, []);

    return (
        <tr>
            <th scope="row">
                <label htmlFor={`guide-${label}`}>{label}</label>
            </th>
            <td>
                <input
                    ref={input}
                    id={`guide-${label}`}
                    aria-label={`Guide ${label}`}
                    type={typeof value === 'number' ? 'number' : 'text'}
                    step="any"
                    value={draft}
                    disabled={disabled}
                    onChange={(event) => setDraft(event.target.value)}
                    onBlur={() => {
                        const { draft: typed, value: shown, commit: save } = latest.current;
                        if (typed !== String(shown)) {
                            save(typed);
                        }
                        setDraft(String(latest.current.value));
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.currentTarget.blur();
                        }
                        if (event.key === 'Escape') {
                            event.stopPropagation();
                            setDraft(String(value));
                        }
                    }}
                />
            </td>
        </tr>
    );
}

export function GuideInspector({ id }: { id: string }) {
    const { guide, busy, readOnly } = useAppState((state) => ({
        guide: state.currentDocument.guides[id],
        busy: state.guideDragActive || state.events.pointer.gesture.kind !== 'idle',
        readOnly: isReadOnly(state) || state.currentDocument.locked
    }));
    const { editGuide } = useActions();
    if (!guide) {
        return null;
    }
    const disabled = readOnly || busy || guide.locked;
    const orientation = guide.orientation;
    const axis = orientation === 'vertical' ? 'x' : 'y';

    return (
        <div className={styles.inspector} aria-label="Guide properties">
            <header className={styles.inspectorHeader}>
                <div className={styles.headerIdentity}>
                    <Icon icon={{ component: Ruler, size: 20 }} />
                    <strong>Guide</strong>
                </div>
                <button
                    type="button"
                    aria-label={guide.locked ? 'Unlock guide' : 'Lock guide'}
                    title={guide.locked ? 'Unlock guide' : 'Lock guide'}
                    disabled={readOnly || busy}
                    onClick={() => editGuide({ id, kind: 'locked', value: !guide.locked })}
                >
                    <Icon icon={{ component: guide.locked ? Lock : LockOpen, size: 16 }} />
                </button>
            </header>
            <table>
                <PropertyGroup name="Guide">
                    <GuideField
                        label="Name"
                        value={guide.name}
                        disabled={disabled}
                        commit={(value) => editGuide({ id, kind: 'name', value })}
                    />
                    <tr>
                        <th scope="row">
                            <label htmlFor="guide-orientation">Orientation</label>
                        </th>
                        <td>
                            <select
                                id="guide-orientation"
                                aria-label="Guide orientation"
                                value={guide.orientation}
                                disabled={disabled}
                                onChange={(event) =>
                                    editGuide({
                                        id,
                                        kind: 'orientation',
                                        value: event.target.value as Orientation
                                    })
                                }
                            >
                                <option value="horizontal">Horizontal</option>
                                <option value="vertical">Vertical</option>
                            </select>
                        </td>
                    </tr>
                    <GuideField
                        key={axis}
                        label={axis.toUpperCase()}
                        value={guide.position[axis]}
                        disabled={disabled}
                        commit={(value) => {
                            if (!value.trim()) {
                                return;
                            }
                            editGuide({
                                id,
                                kind: 'position',
                                orientation,
                                value: Number(value)
                            });
                        }}
                    />
                    <tr>
                        <td colSpan={2}>
                            <small className={styles.frameHint}>
                                Canvas coordinates. Changing orientation keeps the same position.
                            </small>
                        </td>
                    </tr>
                    <tr>
                        <td colSpan={2}>
                            <button
                                type="button"
                                disabled={disabled}
                                onClick={() => editGuide({ id, kind: 'delete' })}
                            >
                                Delete guide
                            </button>
                        </td>
                    </tr>
                </PropertyGroup>
            </table>
        </div>
    );
}
