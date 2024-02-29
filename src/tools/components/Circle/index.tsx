import React, { FC, useRef } from 'react';

import styles from '../../styles.css';
import type { Command, Position } from 'src/app/types';
import type { Tool } from 'src/tools/types';
import { Pointer } from '../../../events/types';
import { newShapeName } from 'src/app/factories';
import { usePointer } from '../../../app/hooks';

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
    position: Position;
    radius: number;
    selected: boolean;
    type: string;
}

export const createCircleProps = (
    { center, scaledCenter, radius, scaledRadius }: Pointer,
    designMode = false
): Props => {
    const name = designMode ? 'Circle x' : newShapeName();
    const key = name.toLowerCase();

    return {
        key,
        name,
        position: designMode ? scaledCenter : center,
        radius: designMode ? scaledRadius : radius,
        selected: true,
        type: 'circle'
    };
};

export const Circle: FC<Props> = ({ key, name, position, radius, selected }) => {
    const shape = useRef(null);
    const className = selected ? `${styles.shape} ${styles.selected}` : styles.shape;
    console.log('rendering Circle');

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
            onClick={() => {
                // console.log('circle native bbox', shape.current.getBBox());
                console.log('Circle:onClick', { position, radius });
                // console.log(
                //   'circle cacl bbox',
                //   getBoundingBoxForCircle({ center: { x: cx, y: cy }, radius: r })
                // );
            }}
        />
    );
};

export const DesignCircle: FC = () => {
    const pointer = usePointer();

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
    canExecute: (context) => true,
    execute: ({ actions, state }) => {
        console.log('CircleCommand:execute');

        const shape = createCircleProps(state.events.pointer, true);

        actions.addShape(shape);
    }
};

export const CircleTool: Tool = {
    id: 'circle',
    name: 'Circle',
    description: 'Draw a circle',
    command: CircleCommand,
    component: Circle,
    designComponent: DesignCircle
};
