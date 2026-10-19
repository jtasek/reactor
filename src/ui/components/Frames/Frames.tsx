import React, { type FC } from 'react';
import { useActions, useAppState, useCameraScale, useGesture } from 'src/app/hooks';
import { isReadOnly } from 'src/app/documentAccess';
import type { ResizeHandlerType } from 'src/app/types';
import styles from './styles.css';

const HANDLE_RADIUS = 5;
const LABEL_OFFSET = 8;
const HANDLES: [ResizeHandlerType, number, number][] = [
    ['topLeft', 0, 0],
    ['topRight', 1, 0],
    ['bottomLeft', 0, 1],
    ['bottomRight', 1, 1]
];

const CanvasFrame: FC<{ id: string; interactive: boolean }> = ({ id, interactive }) => {
    const { frame, selected, editable, drawing } = useAppState((state) => ({
        frame: state.currentDocument.frames[id],
        selected: state.currentDocument.selectedFrameId === id,
        editable: !isReadOnly(state) && !state.currentDocument.locked,
        drawing: state.tools.activeToolsIds[0] !== 'select'
    }));
    const zoom = useCameraScale();
    const scale = interactive ? zoom : 1;
    const gesture = useGesture();
    const { editFrame } = useActions();

    if (!frame?.visible) {
        return null;
    }

    const { position, size } = frame;
    const handles = interactive && selected && editable && !frame.locked && !drawing;
    const active =
        gesture.kind === 'editingFrame' && gesture.frameId === id ? gesture.handle : null;

    return (
        <g
            data-frame={id}
            className={`${styles.frame} ${selected && interactive ? styles.selected : ''}`}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={interactive ? `Frame ${frame.name}` : undefined}
            aria-pressed={interactive ? selected : undefined}
            onKeyDown={
                interactive
                    ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              editFrame({ kind: 'select', id });
                          }
                      }
                    : undefined
            }
        >
            <g data-handle={interactive ? true : undefined} data-frame-id={id} data-type="move">
                {interactive && (
                    <rect
                        className={styles.hit}
                        x={position.x}
                        y={position.y}
                        width={size.width}
                        height={size.height}
                    />
                )}
                <rect
                    className={styles.edge}
                    x={position.x}
                    y={position.y}
                    width={size.width}
                    height={size.height}
                />
                <text
                    className={styles.label}
                    transform={`translate(${position.x} ${position.y - LABEL_OFFSET / scale}) scale(${1 / scale})`}
                >
                    {frame.name}
                </text>
            </g>
            {handles &&
                HANDLES.map(([type, x, y]) => (
                    <circle
                        key={type}
                        className={`${styles.handle} ${active === type ? styles.active : ''}`}
                        cx={position.x + x * size.width}
                        cy={position.y + y * size.height}
                        r={HANDLE_RADIUS / scale}
                        data-handle
                        data-frame-id={id}
                        data-type={type}
                        style={{ cursor: x === y ? 'nwse-resize' : 'nesw-resize' }}
                    />
                ))}
        </g>
    );
};

/** Interior is transparent to input: artwork remains independently selectable. */
export const Frames: FC<{ interactive?: boolean }> = ({ interactive = true }) => {
    const ids = useAppState((state) => {
        if (state.currentDocument.editingComponentId) {
            return [];
        }

        const ids = state.currentDocument.framesIds;
        const selected = state.currentDocument.selectedFrameId;

        // Selected handles must stay above every other frame's hit area.
        return [...ids.filter((id) => id !== selected), ...ids.filter((id) => id === selected)];
    });

    return (
        <g id="frames" pointerEvents={interactive ? undefined : 'none'}>
            {ids.map((id) => (
                <CanvasFrame key={id} id={id} interactive={interactive} />
            ))}
        </g>
    );
};
