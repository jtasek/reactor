import { PenTool as PenIcon } from 'lucide-react';
import React, { FC } from 'react';

import styles from '../../styles.css';
import type { Command, PathPoint, Point } from 'src/app/types';
import type { Tool } from 'src/tools/types';
import type { Context } from 'src/app';
import { mapPathPoints, pathData } from 'src/app/pathGeometry';
import { useAppState, usePointer } from 'src/app/hooks';
import { beyondClickSlip } from 'src/events/gestures';
import { Path } from '../Pencil';

/** How close, in screen pixels, a click must land on a point to close or finish the path there. */
export const PEN_CLOSE_DISTANCE = 8;

/** The point a press places: a corner, or with a drag, a smooth point whose handles follow it. */
export const placedPoint = (start: Point, current: Point, scale: number): PathPoint =>
    beyondClickSlip(start, current, scale)
        ? {
              x: start.x,
              y: start.y,
              in: { x: 2 * start.x - current.x, y: 2 * start.y - current.y },
              out: { x: current.x, y: current.y }
          }
        : { x: start.x, y: start.y };

const near = (a: Point, b: Point, scale: number) =>
    Math.hypot(a.x - b.x, a.y - b.y) * scale <= PEN_CLOSE_DISTANCE;

/** Adds the path drawn so far to the document, when it has a segment, and starts afresh. */
export const finishPath = ({ state, actions }: Context, closed = false) => {
    const points = mapPathPoints(state.tools.penDraft, ({ x, y }) => ({ x, y }));

    state.tools.penDraft = [];
    if (points.length > 1) {
        actions.drawShape({ type: 'path', points, selected: true, ...(closed && { closed }) });
    }
};

export const DesignPen: FC = () => {
    const draft = useAppState((state) => state.tools.penDraft);
    const scale = useAppState((state) => state.currentDocument.camera.scale);
    const { current, dragging, start } = usePointer();
    const at = dragging ? start : current;
    const closing = draft.length > 2 && near(draft[0], at, scale);
    const placing: PathPoint = dragging ? placedPoint(start, current, scale) : at;
    const anchor = 4 / scale;

    return (
        <g>
            <path
                className={`${styles.shape} ${styles.selected}`}
                d={pathData({
                    points: closing ? draft : [...draft, placing],
                    closed: closing || undefined
                })}
            />
            {placing.in && placing.out && (
                <>
                    <path
                        className={styles.penHandle}
                        d={`M${placing.in.x} ${placing.in.y}L${placing.out.x} ${placing.out.y}`}
                    />
                    {[placing.in, placing.out].map(({ x, y }) => (
                        <circle
                            key={`${x} ${y}`}
                            className={styles.penAnchor}
                            cx={x}
                            cy={y}
                            r={anchor * 0.75}
                        />
                    ))}
                </>
            )}
            {draft.map((point, index) => (
                <rect
                    key={index}
                    className={styles.penAnchor}
                    data-closing={(index === 0 && closing) || undefined}
                    x={point.x - anchor}
                    y={point.y - anchor}
                    width={anchor * 2}
                    height={anchor * 2}
                />
            ))}
        </g>
    );
};

export const PenCommand: Command = {
    id: 'pen',
    name: 'Pen',
    category: 'shapes',
    description: 'Click for corners, drag for curves; click the first point to close',
    icon: {
        component: PenIcon,
        color: 'rgba(255,255,255)',
        size: 24
    },
    shortcut: 'shift+p',
    canExecute: () => true,
    execute: (context) => {
        const { state } = context;
        const { current, start } = state.events.pointer;
        const draft = state.tools.penDraft;
        const scale = state.currentDocument.camera.scale;

        if (draft.length > 2 && near(draft[0], start, scale)) {
            finishPath(context, true);
        } else if (draft.length > 1 && near(draft[draft.length - 1], start, scale)) {
            finishPath(context);
        } else {
            draft.push(placedPoint(start, current, scale));
        }
    },
    shouldDeactivate: ({ state }) => state.tools.penDraft.length === 0
};

export const PenTool: Tool = {
    ...PenCommand,
    component: Path,
    draws: 'path',
    deactivate: finishPath,
    designComponent: DesignPen
};

/** Enter or Escape keeps the path drawn so far and puts the Pen down. */
export const FinishPathCommand: Command = {
    id: 'finish-path',
    name: 'Finish path',
    category: 'shapes',
    shortcut: 'enter,escape',
    places: [],
    canExecute: ({ state }) => state.tools.penDraft.length > 0,
    execute: (context) => {
        finishPath(context);
        context.actions.tools.resetTools();
    }
};
