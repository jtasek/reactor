import React, { FC } from 'react';

import styles from '../../styles.css';
import type { Command, Point } from 'src/app/types';
import type { Pointer } from 'src/events/types';
import type { Tool } from 'src/tools/types';
import { newShapeName } from 'src/app/factories';
import { usePointer } from 'src/app/hooks';

/**
 * Draws a line from the start point to the end point
 **/

interface Props {
    end: Point;
    key: string;
    name: string;
    selected: boolean;
    start: Point;
    type: 'line';
}

export const createLineProps = ({ start, scaledStart, current, scaledCurrent }: Pointer, designMode = false): Props => {
    const name = designMode ? 'Line x' : newShapeName();
    const key = name.toLowerCase();

    return {
        end: designMode ? scaledCurrent : current,
        key,
        name,
        selected: true,
        start: designMode ? scaledStart : start,
        type: 'line'
    };
};

export const Line: FC<Props> = ({ key, name, start, end, selected }) => {
    const className = selected ? `${styles.shape} ${styles.selected}` : styles.shape;
    console.log('rendering Line');

    return (
        <line
            className={className}
            data-cy={name}
            key={key}
            x1={start.x}
            x2={end.x}
            y1={start.y}
            y2={end.y}
        />
    );
};

export const DesignLine: FC = () => {
    const pointer = usePointer();

    const { key, name, start, end, selected, type } = createLineProps(pointer, true);

    return <Line key={key} name={name} start={start} end={end} selected={selected} type={type} />;
};

export const LineCommand: Command = {
    id: 'line',
    name: 'Line',
    category: 'shapes',
    description: 'Draw a straight line',
    icon: {
        group: 'action',
        name: 'timeline',
        color: 'rgb(95, 216, 240)',
        size: 24
    },
    regex: /(?<toolCode>line)\((?<x1>\d+),(?<y1>\d+),(?<x2>\d+),(?<y2>\d+)\)/,
    shortcut: 'ctrl+l',
    canExecute: (context) => true,
    execute: ({ actions, state }) => {
        console.log('LineCommand:execute');

        const shape = createLineProps(state.events.pointer, true);

        actions.addShape(shape);
    }
};

export const LineTool: Tool = {
    ...LineCommand,
    component: Line,
    designComponent: DesignLine
};
