import { Label } from 'src/ui/components/Label';
import { MoveUpRight, Slash } from 'lucide-react';
import React, { FC } from 'react';

import styles from '../../styles.css';
import type { Command, Point } from 'src/app/types';
import type { Pointer } from 'src/events/types';
import type { Tool } from 'src/tools/types';
import { useAppState, usePointer } from 'src/app/hooks';
import { arrowHeadPoints, snapToEighth } from 'src/app/lineGeometry';
import { stringifyPath } from 'src/app/utils';

/**
 * Draws a line from the start point to the end point, with an arrowhead at the end
 * when `arrow` is set.
 **/

interface Props {
    arrow?: true;
    end: Point;
    name?: string;
    selected: boolean;
    start: Point;
    type: 'line';
}

interface LineOptions {
    /** Snaps the line to the nearest 45°, as Shift does while drawing. */
    snap?: boolean;
    arrow?: boolean;
    designMode?: boolean;
}

export const createLineProps = (
    { start, current }: Pointer,
    { snap, arrow, designMode }: LineOptions = {}
): Props => ({
    ...(arrow && { arrow: true as const }),
    end: snap ? snapToEighth(start, current) : current,
    name: designMode ? (arrow ? 'Arrow x' : 'Line x') : undefined,
    selected: true,
    start,
    type: 'line'
});

export const Line: FC<Props> = ({ arrow, name, start, end, selected }) => {
    const className = selected ? `${styles.shape} ${styles.selected}` : styles.shape;
    const line = (
        <line
            className={className}
            data-cy={name}
            x1={start.x}
            x2={end.x}
            y1={start.y}
            y2={end.y}
        />
    );

    if (!arrow) {
        return line;
    }

    return (
        <>
            {line}
            <polyline
                className={className}
                style={{ fill: 'none' }}
                points={stringifyPath(arrowHeadPoints(start, end))}
            />
        </>
    );
};

const designLine = (arrow: boolean): FC =>
    function DesignLine() {
        const pointer = usePointer();
        const snap = useAppState((state) => state.events.keyboard.shiftKey);

        if (!pointer.dragging) {
            return null;
        }

        const props = createLineProps(pointer, { snap, arrow, designMode: true });

        return (
            <>
                <Line {...props} />
                <Label shape={props} />
            </>
        );
    };

const drawLine =
    (arrow: boolean): Command['execute'] =>
    ({ actions, state }) => {
        actions.drawShape(
            createLineProps(state.events.pointer, {
                snap: state.events.keyboard.shiftKey,
                arrow
            })
        );
    };

export const LineCommand: Command = {
    id: 'line',
    name: 'Line',
    category: 'shapes',
    description: 'Draw a straight line',
    icon: {
        component: Slash,
        color: 'rgb(95, 216, 240)',
        size: 24
    },
    regex: /(?<toolCode>line)\((?<x1>\d+),(?<y1>\d+),(?<x2>\d+),(?<y2>\d+)\)/,
    shortcut: 'l',
    canExecute: ({ state }) =>
        state.events.pointer.size.width > 0 || state.events.pointer.size.height > 0,
    execute: drawLine(false),
    shouldDeactivate: ({ state }) => !state.events.pointer.dragging
};

export const LineTool: Tool = {
    ...LineCommand,
    component: Line,
    designComponent: designLine(false)
};

export const ArrowTool: Tool = {
    ...LineCommand,
    id: 'arrow',
    name: 'Arrow',
    description: 'Draw an arrow',
    icon: { ...LineCommand.icon!, component: MoveUpRight },
    regex: /arrow/,
    shortcut: 'shift+l',
    execute: drawLine(true),
    designComponent: designLine(true)
};
