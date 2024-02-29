import React, { FC } from 'react';

import inlineStyles from './inlineStyles';
import type { Position, Size } from 'src/app/types';
import type { Tool } from 'src/tools/types';
import { Command } from 'src/app/types';
import { Pointer } from '../../../events/types';
import { isPointInBox } from 'src/app/utils';
import { usePointer } from '../../../app/hooks';

/**
 * Selects highlighted shapes
 **/

interface Props {
    key: string;
    name: string;
    position: Position;
    size: Size;
    type: string;
}

export function createSelectProps(
    { topLeftPosition, scaledTopLeftPosition, size, scaledSize }: Pointer,
    designMode = false
): Props {
    return {
        key: 'selection',
        name: 'selection',
        position: designMode ? scaledTopLeftPosition : topLeftPosition,
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
    category: 'shapes',
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
    execute: ({ actions, state: { events, currentDocument } }) => {
        console.log('SelectCommand:execute');
        const currentPointer = events.pointer.position;

        Object.values(currentDocument.shapes).forEach((shape) => {
            if (isPointInBox(currentPointer, shape)) {
                shape.selected = true;
            }
        });
    }
};

export const SelectTool: Tool = {
    id: 'select',
    name: 'Select',
    description: 'Select a shape or group',
    command: SelectCommand,
    designComponent: DesignSelect
};
