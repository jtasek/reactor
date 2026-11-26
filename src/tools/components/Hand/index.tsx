import { Hand as HandIcon } from 'lucide-react';
import { FC } from 'react';

import type { Command } from 'src/app/types';
import type { Tool } from 'src/tools/types';

/** Pans the canvas: the pointer adapter drags the camera while this tool is active. */
export const DesignHand: FC = () => null;

export const HandCommand: Command = {
    id: 'hand',
    name: 'Hand',
    category: 'tools',
    description: 'Drag to move around the canvas (hold Space)',
    icon: {
        component: HandIcon,
        color: 'rgba(255,255,255)',
        size: 24
    },
    regex: /hand/,
    canExecute: () => false,
    execute: () => undefined
};

export const HandTool: Tool = {
    ...HandCommand,
    designComponent: DesignHand
};
