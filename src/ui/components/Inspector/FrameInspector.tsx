import React, { type FC, useEffect, useState } from 'react';
import { useActions, useAppState } from 'src/app/hooks';
import { useFrameMoveProblem, useFrameLocked } from 'src/app/frameHooks';
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

export const FrameInspector: FC<{ id: string }> = ({ id }) => {
    const { frame, locked } = useAppState((state) => ({
        frame: state.currentDocument.frames[id],
        locked: state.currentDocument.locked
    }));
    const { editFrame } = useActions();
    const moveProblem = useFrameMoveProblem(id);
    const inheritedLocked = useFrameLocked(id);

    if (!frame) {
        return null;
    }

    const disabled = locked || inheritedLocked;

    return (
        <div className={styles.inspector} aria-label="Frame properties">
            <header className={styles.inspectorHeader}>
                <strong>Frame</strong>
            </header>
            <table>
                <PropertyGroup name="Frame">
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
                            disabled={disabled || Boolean(moveProblem)}
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
                    {moveProblem && (
                        <tr>
                            <td colSpan={2}>
                                <small role="status">{moveProblem}</small>
                            </td>
                        </tr>
                    )}
                    {(['width', 'height'] as const).map((key) => (
                        <Field
                            key={key}
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
                </PropertyGroup>
            </table>
        </div>
    );
};
