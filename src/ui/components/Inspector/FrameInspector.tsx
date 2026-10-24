import type { Gesture } from 'src/events/types';
import { frameParents } from 'src/app/frameMembership';
import { renderedFrame, frameLayout } from 'src/app/frameLayout';
import React, { type FC, useEffect, useState } from 'react';
import { useActions, useAppState } from 'src/app/hooks';
import { useFrameMoveProblem, useFrameLocked } from 'src/app/frameHooks';
import { SizingFields } from './SizingFields';
import { FrameParent } from './FrameParent';
import { PropertyGroup } from './PropertyGroup';
import styles from './styles.css';
import { MIN_FRAME_SIZE } from 'src/app/services/documentStorage';

const Field: FC<{
    label: string;
    value: string | number;
    disabled: boolean;
    minimum?: number;
    onCommit: (value: string) => void;
}> = ({ label, value, disabled, minimum, onCommit }) => {
    const [draft, setDraft] = useState(String(value));
    const id = `frame-${label.replaceAll(' ', '-').toLowerCase()}`;

    useEffect(() => setDraft(String(value)), [value]);

    return (
        <tr>
            <th scope="row">
                <label htmlFor={id}>{label}</label>
            </th>
            <td>
                <input
                    id={id}
                    aria-label={`Frame ${label.toLowerCase()}`}
                    type={typeof value === 'number' ? 'number' : 'text'}
                    step={typeof value === 'number' ? 'any' : undefined}
                    min={minimum}
                    disabled={disabled}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onBlur={() => {
                        const number = Number(draft);
                        if (
                            !draft.trim() ||
                            (typeof value === 'number' &&
                                (!Number.isFinite(number) ||
                                    (minimum !== undefined && number < minimum)))
                        ) {
                            setDraft(String(value));

                            return;
                        }

                        onCommit(draft);
                        setDraft(String(value));
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            event.currentTarget.blur();
                        }
                    }}
                />
            </td>
        </tr>
    );
};

/** Only a canvas gesture on this frame, or on a frame that carries it along, holds its fields. */
const editedOnCanvas = (gesture: Gesture, id: string) =>
    gesture.kind === 'editingFrame' &&
    (gesture.frameId === id || Object.hasOwn(gesture.childFrames, id));

export const FrameInspector: FC<{ id: string }> = ({ id }) => {
    const { frame, authoredSize, locked, layout, nested, busy } = useAppState((state) => ({
        frame: renderedFrame(state.currentDocument, id),
        nested: Boolean(frameParents(state.currentDocument.frames).get(id)),
        busy: editedOnCanvas(state.events.pointer.gesture, id),
        layout: frameLayout(state.currentDocument),
        authoredSize: state.currentDocument.frames[id]?.size,
        locked: state.currentDocument.locked
    }));
    const { editFrame } = useActions();
    const moveProblem = useFrameMoveProblem(id);
    const inheritedLocked = useFrameLocked(id);

    if (!frame) {
        return null;
    }

    const disabled = locked || inheritedLocked || busy;

    return (
        <div className={styles.inspector} aria-label="Frame properties">
            <header className={styles.inspectorHeader}>
                <strong>{frame.kind === 'screen' ? 'Screen' : 'Frame'}</strong>
            </header>
            <table>
                <PropertyGroup name="Frame">
                    <tr>
                        <th scope="row">
                            <label htmlFor="frame-kind">Type</label>
                        </th>
                        <td>
                            <select
                                id="frame-kind"
                                aria-label="Frame type"
                                disabled={disabled}
                                value={frame.kind ?? 'frame'}
                                onChange={(event) =>
                                    editFrame({
                                        kind: 'update',
                                        id,
                                        changes: {
                                            kind:
                                                event.target.value === 'screen' ? 'screen' : 'frame'
                                        }
                                    })
                                }
                            >
                                <option value="frame">Frame</option>
                                <option value="screen">Screen</option>
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <td colSpan={2}>
                            <small className={styles.frameHint} role="status">
                                {frame.kind !== 'screen'
                                    ? 'Choose Screen to make this frame a prototype destination.'
                                    : nested
                                      ? 'Move this screen to Canvas to use it as a prototype destination.'
                                      : 'A prototype destination. Other screens remain on the same canvas.'}
                            </small>
                        </td>
                    </tr>
                    <FrameParent frameId={id} />
                    <Field
                        label="Name"
                        value={frame.name}
                        disabled={disabled}
                        onCommit={(name) => editFrame({ kind: 'update', id, changes: { name } })}
                    />
                    {(['x', 'y'] as const).map((key) => (
                        <Field
                            key={key}
                            label={key.toUpperCase()}
                            value={frame.position[key]}
                            disabled={
                                disabled || Boolean(moveProblem) || layout.managedFrames.has(id)
                            }
                            onCommit={(value) =>
                                editFrame({
                                    kind: 'update',
                                    id,
                                    changes: {
                                        position: {
                                            x: frame.position.x - (layout.frames[id]?.x ?? 0),
                                            y: frame.position.y - (layout.frames[id]?.y ?? 0),
                                            [key]: Number(value) - (layout.frames[id]?.[key] ?? 0)
                                        }
                                    }
                                })
                            }
                        />
                    ))}
                    {moveProblem && (
                        <tr>
                            <td colSpan={2}>
                                <small className={styles.frameHint} role="status">
                                    {moveProblem}
                                </small>
                            </td>
                        </tr>
                    )}
                    {(['width', 'height'] as const).map((key) => (
                        <Field
                            key={key}
                            label={key === 'width' ? 'Width' : 'Height'}
                            value={frame.size[key]}
                            minimum={MIN_FRAME_SIZE}
                            disabled={
                                disabled || (frame.sizing?.[key]?.mode ?? 'fixed') !== 'fixed'
                            }
                            onCommit={(value) =>
                                editFrame({
                                    kind: 'update',
                                    id,
                                    changes: { size: { ...authoredSize!, [key]: Number(value) } }
                                })
                            }
                        />
                    ))}
                </PropertyGroup>
                <SizingFields frameId={id} />
                <PropertyGroup name="Layout">
                    <tr>
                        <th scope="row">
                            <label htmlFor="frame-layout">Layout</label>
                        </th>
                        <td>
                            <select
                                id="frame-layout"
                                aria-label="Frame layout"
                                disabled={disabled}
                                value={frame.stack?.direction ?? 'free'}
                                onChange={(event) =>
                                    editFrame({
                                        kind: 'update',
                                        id,
                                        changes: {
                                            stack:
                                                event.target.value === 'free'
                                                    ? null
                                                    : {
                                                          direction: event.target.value as
                                                              | 'row'
                                                              | 'column',
                                                          gap: frame.stack?.gap ?? 0,
                                                          padding: frame.stack?.padding ?? 0,
                                                          align: frame.stack?.align ?? 'start'
                                                      }
                                        }
                                    })
                                }
                            >
                                <option value="free">Free</option>
                                <option value="row">Row</option>
                                <option value="column">Column</option>
                            </select>
                        </td>
                    </tr>
                    {frame.stack && (
                        <>
                            <Field
                                label="Gap"
                                value={frame.stack.gap}
                                minimum={0}
                                disabled={disabled}
                                onCommit={(value) =>
                                    editFrame({
                                        kind: 'update',
                                        id,
                                        changes: { stack: { ...frame.stack!, gap: Number(value) } }
                                    })
                                }
                            />
                            <Field
                                label="Padding"
                                value={frame.stack.padding}
                                minimum={0}
                                disabled={disabled}
                                onCommit={(value) =>
                                    editFrame({
                                        kind: 'update',
                                        id,
                                        changes: {
                                            stack: { ...frame.stack!, padding: Number(value) }
                                        }
                                    })
                                }
                            />
                            <tr>
                                <th scope="row">
                                    <label htmlFor="frame-alignment">Alignment</label>
                                </th>
                                <td>
                                    <select
                                        id="frame-alignment"
                                        aria-label="Frame alignment"
                                        disabled={disabled}
                                        value={frame.stack.align}
                                        onChange={(event) =>
                                            editFrame({
                                                kind: 'update',
                                                id,
                                                changes: {
                                                    stack: {
                                                        ...frame.stack!,
                                                        align: event.target.value as
                                                            | 'start'
                                                            | 'center'
                                                            | 'end'
                                                    }
                                                }
                                            })
                                        }
                                    >
                                        <option value="start">Start</option>
                                        <option value="center">Center</option>
                                        <option value="end">End</option>
                                    </select>
                                </td>
                            </tr>
                        </>
                    )}
                    {layout.problems[id] && (
                        <tr>
                            <td colSpan={2}>
                                <small className={styles.frameHint} role="status">
                                    {layout.problems[id]}
                                </small>
                            </td>
                        </tr>
                    )}
                </PropertyGroup>
            </table>
        </div>
    );
};
