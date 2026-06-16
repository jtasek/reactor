import React, { FC, useEffect } from 'react';

import styles from './styles.css';
import type { Point, Size } from 'src/app/types';
import type { Tool } from 'src/tools/types';
import { Command } from 'src/app/types';
import { Pointer } from '../../../events/types';
import { useActions, usePointer } from '../../../app/hooks';
import { Context } from 'src/app';

/**
 * Selects highlighted shapes
 **/

interface Props {
    key: string;
    name: string;
    position: Point;
    size: Size;
    type: string;
}

export function createSelectProps({ topLeft, size }: Pointer): Props {
    return {
        key: 'selection',
        name: 'selection',
        position: topLeft,
        size: size,
        type: 'select'
    };
}

export const Select: FC<Props> = ({ key, name, position, size }) => {
    return (
        <rect
            data-cy={name}
            height={size.height}
            key={key}
            strokeDasharray="5, 5"
            className={styles.selectable}
            width={size.width}
            x={position.x}
            y={position.y}
        />
    );
};

export const DesignSelect: FC = () => {
    const pointer = usePointer();
    const { selectShapes } = useActions();

    const { current, dragging, background } = pointer;

    // While the marquee is being dragged, keep the selection in sync with the box.
    useEffect(() => {
        if (dragging && background) {
            selectShapes();
        }
    }, [dragging, background, current.x, current.y, selectShapes]);

    // The marquee only appears for drags that begin on empty canvas — never for
    // shape interactions such as resizing a handle.
    if (!dragging || !background) {
        return null;
    }

    const { key, name, position, size, type } = createSelectProps(pointer);

    return <Select key={key} name={name} position={position} size={size} type={type} />;
};

export const SelectCommand: Command = {
    id: 'select',
    name: 'Select',
    category: 'tools',
    description: 'Selects shapes and groups ',
    icon: {
        group: 'action',
        name: 'pan_tool',
        color: 'rgba(255,255,255)',
        size: 24
    },
    regex: /(?<toolCode>select)\((?<x1>[\d]+),(?<y1>[\d]+),(?<x2>[\d]+),(?<y2>[\d]+)\)/,
    shortcut: 's',
    canExecute: ({ state }) => state.events.pointer.background,
    execute: ({ actions }) => {
        actions.selectShapes();
    },
    shouldDeactivate: function (context: Context): boolean {
        return !context.state.events.pointer.dragging;
    }
};

export const SelectTool: Tool = {
    ...SelectCommand,
    component: Select,
    designComponent: DesignSelect
};
