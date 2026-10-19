import React, { type FC } from 'react';
import { useActions } from 'src/app/hooks';
import { useFrameParent } from 'src/app/frameHooks';

/** Membership is explicit; changing it never converts the canvas coordinates. */
export const FrameParent: FC<{ frameId?: string; shapeIds?: string[] }> = ({
    frameId,
    shapeIds = []
}) => {
    const { value, choices, disabled, problem } = useFrameParent(frameId, shapeIds);
    const { editFrame } = useActions();
    const id = frameId ? 'frame-parent' : 'shape-frame-parent';

    return (
        <tr>
            <th scope="row">
                <label htmlFor={id}>Parent</label>
            </th>
            <td>
                <select
                    id={id}
                    aria-label={frameId ? 'Frame parent' : 'Selection parent'}
                    aria-describedby={problem ? `${id}-problem` : undefined}
                    value={value}
                    disabled={disabled}
                    onChange={(event) => {
                        const parentFrameId = event.target.value || null;

                        if (frameId) {
                            editFrame({ kind: 'update', id: frameId, changes: { parentFrameId } });

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
                        <option key={frame.id} value={frame.id}>
                            {frame.name}
                        </option>
                    ))}
                </select>
                {problem && (
                    <small id={`${id}-problem`} role="status">
                        {problem}
                    </small>
                )}
            </td>
        </tr>
    );
};
