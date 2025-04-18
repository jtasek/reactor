import React, { FC, useRef } from 'react';

import styles from '../../styles.css';
import type { Command, Point, Size } from 'src/app/types';
import type { Pointer } from 'src/events/types';
import type { Tool } from 'src/tools/types';
import { newShapeName } from 'src/app/factories';
import { useActions, usePointer } from 'src/app/hooks';

/**
 * Draws a rectangle based on position and size

 <rect
     x="the x-axis top-left corner of the rectangle"
     y="the y-axis top-left corner of the rectangle"
     rx="the x-axis radius (to round the element)"
     ry="the y-axis radius (to round the element)"
     width="the width of the rectangle. Required."
     height="the height of the rectangle Required."
 />
 **/

interface Props {
  
    key: string;
    name: string;
    position: Point;
    selected: boolean;
    size: Size;
    type: 'rectangle';
}

export const createRectProps = (
    { start, scaledStart, size, scaledSize }: Pointer,
    designMode = false
): Props => {
    const name = designMode ? 'Rectangle x' : newShapeName();
    const key = name.toLowerCase();

    return {
        key,
        name,
        position: designMode ? scaledStart : start,
        selected: true,
        size: designMode ? scaledSize : size,
        type: 'rectangle'
    };
};

export const Rect: FC<Props> = ({ key, name, position, size, selected }) => {
    const actions = useActions();
    const shape = useRef(null);
    const className = selected ? `${styles.shape} ${styles.selected}` : styles.shape;
    console.log('rendering Rect');

    return (
        <rect
            className={className}
            data-cy={name}
            fill="none"
            height={size?.height}
            key={key}
            ref={shape}
            width={size?.width}
            x={position?.x}
            y={position?.y}
        />
    );
};

export const DesignRect: FC = () => {
    const pointer = usePointer();

    const { key, name, position, selected, size, type } = createRectProps(pointer, true);

    return <Rect key={key} name={name} position={position} size={size} selected={selected} type={type} />;
};

export const RectCommand: Command = {
    id: 'rectangle',
    name: 'Rectangle',
    category: 'shapes',
    description: 'Draws a rectangle or square',
    icon: {
        group: 'image',
        name: 'crop_square',
        color: 'rgba(255,255,255)',
        size: 24
    },
    regex: /(?<toolCode>rect)\((?<x1>[\d]+),(?<y1>[\d]+),(?<x2>[\d]+),(?<y2>[\d]+)\)/,
    shortcut: 'r',
    canExecute: (context) => true,
    execute: ({ actions, state }) => {
        console.log('RectCommand:execute');

        const shape = createRectProps(state.events.pointer, true);

        actions.addShape(shape);
    }
};

export const RectTool: Tool = {
    ...RectCommand,
    component: Rect,
    designComponent: DesignRect
};
