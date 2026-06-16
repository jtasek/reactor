import React, { FC, useRef } from 'react';

import styles from '../../styles.css';
import type { Command, Point } from 'src/app/types';
import type { Tool } from 'src/tools/types';
import { Pointer } from '../../../events/types';
import { newShapeName } from 'src/app/factories';
import { usePointer } from '../../../app/hooks';
import { Context } from 'src/app';

/**
 * Draws a circle based on input center point and radius

<circle 
    cx="the x-axis center of the circle" 
    cy="the y-axis center of the circle" 
    r="The circle's radius. Required." 
/>
**/

interface Props {
    key: string;
    name: string;
    position: Point;
    radius: number;
    selected: boolean;
    type: 'circle';
}

export const createCircleProps = ({ center, radius }: Pointer, designMode = false): Props => {
    const name = designMode ? 'Circle x' : newShapeName();
    const key = name.toLowerCase();

    return {
        key,
        name,
        position: center,
        radius: radius,
        selected: true,
        type: 'circle'
    };
};

export const Circle: FC<Props> = ({ name, position, radius, selected }) => {
    const shape = useRef(null);
    const className = selected ? `${styles.shape} ${styles.selected}` : styles.shape;

    return (
        <circle
            className={className}
            cx={position.x}
            cy={position.y}
            data-cy={name}
            fill="none"
            key="circle"
            r={radius}
            ref={shape}
            stroke="grey"
            strokeWidth={2}
        />
    );
};

export const DesignCircle: FC = () => {
    const pointer = usePointer();
    if (!pointer.dragging) {
        return null;
    }

    const props = createCircleProps(pointer, true);

    return <Circle {...props} />;
};

export const CircleCommand: Command = {
    id: 'circle',
    name: 'Circle',
    category: 'shapes',
    description: 'Draws a circle shape',
    icon: {
        group: 'image',
        name: 'panorama_fish_eye',
        color: 'rgb(144, 254, 214)',
        size: 24
    },
    regex: /(?<toolCode>circle)\((?<cx>\d+),(?<cy>\d+),(?<radius>\d+)\)/,
    shortcut: 'ctrl+c',
    canExecute: ({ state }) =>
        state.events.pointer.size.width > 0 || state.events.pointer.size.height > 0,
    execute: ({ actions, state }) => {
        const shape = createCircleProps(state.events.pointer);

        actions.addShape(shape);
    },
    shouldDeactivate: function (context: Context): boolean {
        return !context.state.events.pointer.dragging;
    }
};

export const CircleTool: Tool = {
    ...CircleCommand,
    component: Circle,
    designComponent: DesignCircle
};
