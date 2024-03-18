import React, { FC } from 'react';

import inlineStyles from './inlineStyles';
import type { Point, Size } from 'src/app/types';
import type { Tool } from 'src/tools/types';
import { Command } from 'src/app/types';
import { Pointer } from '../../../events/types';
import { usePointer } from '../../../app/hooks';

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

export function createSelectProps(
    { topLeft, scaledTopLeft, size, scaledSize }: Pointer,
    designMode = false
): Props {
    return {
        key: 'selection',
        name: 'selection',
        position: designMode ? scaledTopLeft : topLeft,
        size: designMode ? scaledSize : size,
        type: 'select'
    };
}

export const Select: FC<Props> = ({ key, name, position, size }) => {
    console.log('rendering Select');

    return (
        <rect
            data-cy={name}
            height={size.height}
            key={key}
            strokeDasharray="5, 5"
            style={inlineStyles}
            width={size.width}
            x={position.x}
            y={position.y}
        />
    );
};

export const DesignSelect: FC = () => {
    const pointer = usePointer();

    const { key, name, position, size, type } = createSelectProps(pointer, true);

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
    canExecute: (context) => true,
    execute: ({ actions }) => {
        console.log('SelectCommand:execute');
        actions.selectShapes();
    }
};

export const SelectTool: Tool = {
    command: SelectCommand,
    designComponent: DesignSelect
};
