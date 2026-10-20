import React, { type FC } from 'react';
import { useActions, useAppState } from 'src/app/hooks';
import { useFrameParent } from 'src/app/frameHooks';
import styles from './styles.css';

/** Membership is explicit; changing it never converts the canvas coordinates. */
export const FrameParent: FC<{ frameId?: string; shapeIds?: string[] }> = ({
    frameId,
    shapeIds = []
}) => {
    const { value, choices, disabled, problem, restriction, stackOrder, inStack, orderShapeIds } =
        useFrameParent(frameId, shapeIds);
    const { editFrame, applyOperations } = useActions();
    const documentId = useAppState((state) => state.currentDocumentId);
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
            {inStack && (
                <tr>
                    <th scope="row">
                        <label htmlFor={`${id}-order`}>Order</label>
                    </th>
                    <td>
                        <input
                            id={`${id}-order`}
                            aria-label="Stack order"
                            type="number"
                            min={0}
                            step={1}
                            value={stackOrder ?? 0}
                            disabled={disabled}
                            onChange={(event) => {
                                const order = Number(event.target.value);
                                if (!event.target.value || !Number.isFinite(order) || order < 0) {
                                    return;
                                }
                                if (frameId) {
                                    editFrame({
                                        kind: 'update',
                                        id: frameId,
                                        changes: { layoutOrder: order }
                                    });
                                    return;
                                }
                                applyOperations({
                                    documentId,
                                    by: { kind: 'person' },
                                    operations: orderShapeIds.map((shape) => ({
                                        op: 'updateShape',
                                        shape,
                                        changes: { layoutOrder: order }
                                    }))
                                });
                            }}
                        />
                    </td>
                </tr>
            )}
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
