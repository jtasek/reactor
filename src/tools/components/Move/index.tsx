import { FC } from 'react';

import type { Command } from 'src/app/types';
import type { Tool } from 'src/tools/types';

/**
 * Moves the current selection. Activated automatically when a drag starts inside
 * a shape; the gesture actions translate the selected shapes as the pointer moves.
 */
export const DesignMove: FC = () => null;

export const MoveCommand: Command = {
    id: 'move',
    name: 'Move',
    category: 'tools',
    description: 'Move the selected shapes',
    icon: {
        group: 'action',
        name: 'open_with',
        color: 'rgba(255,255,255)',
        size: 24
    },
    regex: /move/,
    // Movement is applied live during the drag, so there is nothing to do on
    // pointer-up; the tool deactivates and the canvas falls back to select.
    canExecute: () => false,
    execute: () => undefined,
    shouldDeactivate: ({ state }) => !state.events.pointer.dragging
};

export const MoveTool: Tool = {
    ...MoveCommand,
    designComponent: DesignMove
};
