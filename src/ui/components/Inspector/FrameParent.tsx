import React, { type FC } from 'react';
import { useActions } from 'src/app/hooks';
import { useFrameParent } from 'src/app/frameHooks';
import styles from './styles.css';

/** Membership is explicit; changing it never converts the canvas coordinates. */
export const FrameParent: FC<{ frameId?: string; shapeIds?: string[] }> = ({
    frameId,
    shapeIds = []
}) => {
    const { value, choices, disabled, problem, restriction } = useFrameParent(frameId, shapeIds);
    const { editFrame } = useActions();
    const id = frameId ? 'frame-parent' : 'shape-frame-parent';

    return (
        <>
            <tr>
                <th scope="row">
                    <label htmlFor={id}>Parent</label>
                </th>
                <td>
                    <select
                        id={id}
                        aria-label={frameId ? 'Frame parent' : 'Selection parent'}
                        aria-describedby={
                            [problem && `${id}-problem`, restriction && `${id}-restriction`]
                                .filter(Boolean)
                                .join(' ') || undefined
                        }
                        value={value}
                        disabled={disabled}
                        onChange={(event) => {
                            const parentFrameId = event.target.value || null;

                            if (frameId) {
                                editFrame({
                                    kind: 'update',
                                    id: frameId,
                                    changes: { parentFrameId }
                                });

                                return;
                            }

                            editFrame({ kind: 'reparentShapes', ids: shapeIds, parentFrameId });
                        }}
                    >
                        <option value="">Canvas</option>
                        {problem && (
                            <option value={value} disabled>
                                Invalid parent
                            </option>
                        )}
                        {value === 'mixed' && (
                            <option value="mixed" disabled>
                                Mixed
                            </option>
                        )}
                        {choices.map((frame) => (
                            <option key={frame.id} value={frame.id} disabled={frame.locked}>
                                {frame.name}
                            </option>
                        ))}
                    </select>
                </td>
            </tr>
            {restriction && (
                <tr>
                    <td colSpan={2}>
                        <small id={`${id}-restriction`} className={styles.frameHint} role="status">
                            {restriction} Use Explorer to show or unlock the frame.
                        </small>
                    </td>
                </tr>
            )}
            {problem && (
                <tr>
                    <td colSpan={2}>
                        <small id={`${id}-problem`} className={styles.frameHint} role="status">
                            {problem}
                        </small>
                    </td>
                </tr>
            )}
        </>
    );
};
