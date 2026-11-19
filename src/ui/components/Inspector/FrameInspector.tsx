import type { Gesture } from 'src/events/types';
import { frameParents } from 'src/app/frameMembership';
import { renderedFrame, frameLayout } from 'src/app/frameLayout';
import React, { type FC, memo, useLayoutEffect, useState } from 'react';
import { useActions, useAppState } from 'src/app/hooks';
import { sidesOf, stackPadding, withSides, withStackPadding } from 'src/app/boxModel';
import { SpacingRow } from './SpacingFields';
import { useFrameMoveProblem, useFrameLocked } from 'src/app/frameHooks';
import { ScreenLayouts } from './ScreenLayouts';
import { isScreenLayout } from 'src/app/screenLayouts';
import { screenViewName } from 'src/app/screenViews';
import { SizingFields } from './SizingFields';
import { FrameParent } from './FrameParent';
import { PropertyGroup } from './PropertyGroup';
import { ModeFields } from './ModeFields';
import { FrameVariables } from './FrameVariables';
import styles from './styles.css';
import { MIN_FRAME_SIZE } from 'src/app/services/documentStorage';
import type { Frame } from 'src/app/types';

const Field: FC<{
    label: string;
    value: string | number;
    disabled: boolean;
    minimum?: number;
    prefix?: string;
    onCommit: (value: string) => void;
}> = ({ label, value, disabled, minimum, prefix = 'Frame', onCommit }) => {
    // Unsaved text, or null to show the stored value. Never resetting to a copy of
    // `value` means a commit can't briefly write the pre-commit value back.
    const [edit, setEdit] = useState<string | null>(null);
    const draft = edit ?? String(value);
    const id = `frame-${label.replaceAll(' ', '-').toLowerCase()}`;

    // A stored change replaces unsaved text before paint, so it never lands after the
    // next focus and select-all.
    useLayoutEffect(() => setEdit(null), [value]);

    return (
        <tr>
            <th scope="row">
                <label htmlFor={id}>{label}</label>
            </th>
            <td>
                <input
                    id={id}
                    aria-label={`${prefix} ${label.toLowerCase()}`}
                    type={typeof value === 'number' ? 'number' : 'text'}
                    step={typeof value === 'number' ? 'any' : undefined}
                    min={minimum}
                    disabled={disabled}
                    value={draft}
                    onChange={(event) => setEdit(event.target.value)}
                    onBlur={() => {
                        const number = Number(draft);
                        if (
                            !draft.trim() ||
                            (typeof value === 'number' &&
                                (!Number.isFinite(number) ||
                                    (minimum !== undefined && number < minimum)))
                        ) {
                            setEdit(null);

                            return;
                        }

                        onCommit(draft);
                        setEdit(null);
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

/** Diagnostics depend on artwork and viewport size, not its canvas position. */
const ScreenViewStatus = memo(function ScreenViewStatus({ id }: { id: string }) {
    const message = useAppState((state) => {
        const document = state.currentDocument;
        const frame = document.frames[id];
        const source = document.frames[frame?.screenId ?? ''];
        const problem = document.screenViewGeometry.find((item) => item.view.id === id)?.problem;

        return (
            problem ??
            (source?.kind === 'screen'
                ? 'Every size that shows the same design shares its artwork.'
                : 'Its page is missing. Remove this from the canvas or restore the page.')
        );
    });

    return (
        <small className={styles.frameHint} role="status">
            {message}
        </small>
    );
});

/** Shows the page on the canvas again at one of the configured sizes, right of `from`. */
const CreateViewAtSize: FC<{ screenId: string; from: Frame; disabled: boolean }> = ({
    screenId,
    from,
    disabled
}) => {
    const presets = useAppState((state) => state.config.viewportPresets);
    const { editFrame } = useActions();

    return (
        <select
            aria-label="Show at size"
            value=""
            disabled={disabled}
            onChange={(event) => {
                const preset = presets.find(({ id }) => id === event.target.value);
                if (!preset) {
                    return;
                }
                editFrame({
                    kind: 'addView',
                    screenId,
                    position: { x: from.position.x + from.size.width + 40, y: from.position.y },
                    size: { ...preset.size }
                });
            }}
        >
            <option value="">Show at size…</option>
            {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                    {preset.name} · {preset.size.width} × {preset.size.height}
                </option>
            ))}
        </select>
    );
};

export const FrameInspector: FC<{ id: string }> = ({ id }) => {
    const {
        frame,
        viewName,
        source,
        authoredSize,
        locked,
        layout,
        nested,
        inStack,
        busy,
        screenLayout,
        hasLayouts
    } = useAppState((state) => ({
        frame: renderedFrame(state.currentDocument, id),
        viewName:
            state.currentDocument.frames[id]?.kind === 'view'
                ? screenViewName(state.currentDocument, state.currentDocument.frames[id])
                : '',
        source: state.currentDocument.frames[state.currentDocument.frames[id]?.screenId ?? ''],
        screenLayout: isScreenLayout(state.currentDocument.frames, id),
        hasLayouts: Object.values(state.currentDocument.frames).some(
            (child) => child.screenLayout && child.parentFrameId === id
        ),
        nested: Boolean(frameParents(state.currentDocument.frames).get(id)),
        // Margin only acts in a stack, so a frame elsewhere shows it once it has one.
        inStack:
            Boolean(
                state.currentDocument.frames[
                    frameParents(state.currentDocument.frames).get(id) ?? ''
                ]?.stack
            ) || Boolean(state.currentDocument.frames[id]?.margin),
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
    // A Page nested in another frame is drawn as part of it, so it is treated as a frame.
    const page = frame.kind === 'screen' && !nested && !screenLayout;

    if (frame.kind === 'view') {
        return (
            <div className={styles.inspector} aria-label="Page on canvas properties">
                <header className={styles.inspectorHeader}>
                    <strong>{viewName}</strong>
                </header>
                <table>
                    <ScreenLayouts key={id} viewId={id} disabled={disabled} />
                    <ModeFields target={{ frameId: id }} />
                    <PropertyGroup name="On canvas">
                        <tr>
                            <td colSpan={2}>
                                <ScreenViewStatus id={id} />
                            </td>
                        </tr>
                        <Field
                            prefix="Shown"
                            label="Name"
                            value={frame.name}
                            disabled={disabled}
                            onCommit={(name) =>
                                editFrame({ kind: 'update', id, changes: { name } })
                            }
                        />
                        {(['x', 'y'] as const).map((key) => (
                            <Field
                                key={key}
                                prefix="Shown"
                                label={key.toUpperCase()}
                                value={frame.position[key]}
                                disabled={disabled}
                                onCommit={(value) =>
                                    editFrame({
                                        kind: 'update',
                                        id,
                                        changes: {
                                            position: { ...frame.position, [key]: Number(value) }
                                        }
                                    })
                                }
                            />
                        ))}
                        {(['width', 'height'] as const).map((key) => (
                            <Field
                                key={key}
                                prefix="Shown"
                                label={key === 'width' ? 'Width' : 'Height'}
                                value={frame.size[key]}
                                minimum={MIN_FRAME_SIZE}
                                disabled={disabled}
                                onCommit={(value) =>
                                    editFrame({
                                        kind: 'update',
                                        id,
                                        changes: { size: { ...frame.size, [key]: Number(value) } }
                                    })
                                }
                            />
                        ))}
                        <tr>
                            <td colSpan={2}>
                                {source?.kind === 'screen' && (
                                    <button
                                        type="button"
                                        onClick={() => editFrame({ kind: 'select', id: source.id })}
                                    >
                                        Edit page
                                    </button>
                                )}
                            </td>
                        </tr>
                        <tr>
                            <td colSpan={2}>
                                {source?.kind === 'screen' && (
                                    <button
                                        type="button"
                                        disabled={disabled}
                                        onClick={() =>
                                            editFrame({
                                                kind: 'addView',
                                                screenId: source.id,
                                                position: {
                                                    x: frame.position.x + frame.size.width + 40,
                                                    y: frame.position.y
                                                },
                                                size: frame.size
                                            })
                                        }
                                    >
                                        Show again on canvas
                                    </button>
                                )}
                            </td>
                        </tr>
                        {source?.kind === 'screen' && (
                            <tr>
                                <td colSpan={2}>
                                    <CreateViewAtSize
                                        screenId={source.id}
                                        from={frame}
                                        disabled={disabled}
                                    />
                                </td>
                            </tr>
                        )}
                        <tr>
                            <td colSpan={2}>
                                <button
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => editFrame({ kind: 'delete', id })}
                                >
                                    Remove from canvas
                                </button>
                            </td>
                        </tr>
                    </PropertyGroup>
                </table>
            </div>
        );
    }

    return (
        <div className={styles.inspector} aria-label="Frame properties">
            <header className={styles.inspectorHeader}>
                <strong>{screenLayout ? 'Separate design' : page ? 'Page' : 'Frame'}</strong>
            </header>
            <table>
                <ModeFields target={{ frameId: id }} />
                <PropertyGroup name="Frame">
                    {!nested && (
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
                                                    event.target.value === 'screen'
                                                        ? 'screen'
                                                        : 'frame'
                                            }
                                        })
                                    }
                                >
                                    <option value="frame">Frame</option>
                                    <option value="screen">Page</option>
                                </select>
                            </td>
                        </tr>
                    )}
                    {(screenLayout || !nested) && (
                        <tr>
                            <td colSpan={2}>
                                <small className={styles.frameHint} role="status">
                                    {screenLayout
                                        ? 'A separate design for this page: edits here don’t reach its other sizes. Choose it on the page at a size to draw or edit its contents.'
                                        : page
                                          ? hasLayouts
                                              ? 'Its main design is shared by every size that shows it. Show it on the canvas at a size to see and edit it.'
                                              : 'One design shared by every size. Show it on the canvas at a size to see and edit it.'
                                          : 'Choose Page to make this frame a prototype destination.'}
                                </small>
                            </td>
                        </tr>
                    )}
                    {page && (
                        <tr>
                            <td colSpan={2}>
                                <button
                                    type="button"
                                    disabled={disabled}
                                    onClick={() =>
                                        editFrame({
                                            kind: 'addView',
                                            screenId: frame.id,
                                            position: {
                                                x: frame.position.x + frame.size.width + 40,
                                                y: frame.position.y
                                            },
                                            size: frame.size
                                        })
                                    }
                                >
                                    Show on canvas
                                </button>
                            </td>
                        </tr>
                    )}
                    {page && (
                        <tr>
                            <td colSpan={2}>
                                <CreateViewAtSize
                                    screenId={frame.id}
                                    from={frame}
                                    disabled={disabled}
                                />
                            </td>
                        </tr>
                    )}
                    {page && (
                        <tr>
                            <td colSpan={2}>
                                <button
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => editFrame({ kind: 'delete', id })}
                                >
                                    Delete page
                                </button>
                            </td>
                        </tr>
                    )}
                    {!screenLayout && (
                        <FrameParent
                            frameId={id}
                            canvasOnly={
                                page && hasLayouts
                                    ? 'A page with separate designs stays on Canvas.'
                                    : undefined
                            }
                        />
                    )}
                    <Field
                        label="Name"
                        value={frame.name}
                        disabled={disabled}
                        onCommit={(name) => editFrame({ kind: 'update', id, changes: { name } })}
                    />
                    {screenLayout && (
                        <tr>
                            <td colSpan={2}>
                                <small className={styles.frameHint} role="status">
                                    Size and position follow each size of the page that shows this
                                    design.
                                </small>
                            </td>
                        </tr>
                    )}
                    {!screenLayout && (
                        <>
                            {(['x', 'y'] as const).map((key) => (
                                <Field
                                    key={key}
                                    label={key.toUpperCase()}
                                    value={frame.position[key]}
                                    disabled={
                                        disabled ||
                                        Boolean(moveProblem) ||
                                        layout.managedFrames.has(id)
                                    }
                                    onCommit={(value) =>
                                        editFrame({
                                            kind: 'update',
                                            id,
                                            changes: {
                                                position: {
                                                    x:
                                                        frame.position.x -
                                                        (layout.frames[id]?.x ?? 0),
                                                    y:
                                                        frame.position.y -
                                                        (layout.frames[id]?.y ?? 0),
                                                    [key]:
                                                        Number(value) -
                                                        (layout.frames[id]?.[key] ?? 0)
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
                                        disabled ||
                                        (frame.sizing?.[key]?.mode ?? 'fixed') !== 'fixed'
                                    }
                                    onCommit={(value) =>
                                        editFrame({
                                            kind: 'update',
                                            id,
                                            changes: {
                                                size: { ...authoredSize!, [key]: Number(value) }
                                            }
                                        })
                                    }
                                />
                            ))}
                        </>
                    )}
                </PropertyGroup>
                {!screenLayout && <SizingFields frameId={id} />}
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
                            <SpacingRow
                                key={`padding-${id}`}
                                box="padding"
                                rowHeader
                                value={stackPadding(frame.stack)}
                                disabled={disabled}
                                onChange={(changes) =>
                                    editFrame({
                                        kind: 'update',
                                        id,
                                        changes: { stack: withStackPadding(frame.stack!, changes) }
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
                    {(layout.problems[id] || layout.modeProblems?.[id]) && (
                        <tr>
                            <td colSpan={2}>
                                <small className={styles.frameHint} role="status">
                                    {layout.problems[id] ?? layout.modeProblems?.[id]}
                                </small>
                            </td>
                        </tr>
                    )}
                </PropertyGroup>
                {inStack && !screenLayout && (
                    <PropertyGroup name="Spacing">
                        <SpacingRow
                            key={`margin-${id}`}
                            box="margin"
                            rowHeader
                            value={sidesOf(frame.margin)}
                            disabled={disabled}
                            onChange={(changes) =>
                                editFrame({
                                    kind: 'update',
                                    id,
                                    changes: { margin: withSides(frame.margin, changes) ?? null }
                                })
                            }
                        />
                    </PropertyGroup>
                )}
                <FrameVariables id={id} />
            </table>
        </div>
    );
};
