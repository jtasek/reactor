import { Label } from 'src/ui/components/Label';
import { Square as SquareIcon } from 'lucide-react';
import React, { FC } from 'react';

import type { Command } from 'src/app/types';
import type { Pointer } from 'src/events/types';
import type { Tool } from 'src/tools/types';
import { usePointer } from 'src/app/hooks';
import { Rect, createRectProps } from '../Rect';

/** A rectangle with equal sides, as long as the longer side of the drag, from where it started. */
export const createSquareProps = (pointer: Pointer, designMode = false) => {
    const { start, current, size } = pointer;
    const side = Math.max(size.width, size.height);
    const topLeft = {
        x: current.x < start.x ? start.x - side : start.x,
        y: current.y < start.y ? start.y - side : start.y
    };

    return {
        ...createRectProps({ ...pointer, topLeft, size: { width: side, height: side } }),
        ...(designMode && { name: 'Square x' })
    };
};

export const DesignSquare: FC = () => {
    const pointer = usePointer();
    if (!pointer.dragging) {
        return null;
    }

    const props = createSquareProps(pointer, true);

    return (
        <>
            <Rect {...props} />
            <Label shape={props} />
        </>
    );
};

export const SquareCommand: Command = {
    id: 'square',
    name: 'Square',
    category: 'shapes',
    description: 'Draws a square',
    icon: {
        component: SquareIcon,
        color: 'rgba(255,255,255)',
        size: 24
    },
    regex: /square/,
    shortcut: 'shift+r',
    canExecute: ({ state }) =>
        state.events.pointer.size.width > 0 || state.events.pointer.size.height > 0,
    execute: ({ actions, state }) => {
        actions.drawShape(createSquareProps(state.events.pointer));
    },
    shouldDeactivate: ({ state }) => !state.events.pointer.dragging
};

export const SquareTool: Tool = {
    ...SquareCommand,
    designComponent: DesignSquare
};
