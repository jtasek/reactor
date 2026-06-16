import { FC, useEffect, useRef } from 'react';

import type { Command, Point } from 'src/app/types';
import type { Tool } from 'src/tools/types';
import { useActions, usePointer } from 'src/app/hooks';

/**
 * Moves the current selection. Activated automatically when a drag starts inside
 * a shape; the selected shapes follow the pointer until the button is released.
 */
export const DesignMove: FC = () => {
    const pointer = usePointer();
    const { moveSelectedShapes } = useActions();

    const { current, dragging } = pointer;
    const previous = useRef<Point | null>(null);

    // Translate by the incremental delta between pointer moves so the motion
    // never accumulates or drifts.
    useEffect(() => {
        if (!dragging) {
            previous.current = null;
            return;
        }

        const prev = previous.current;
        if (prev) {
            const dx = current.x - prev.x;
            const dy = current.y - prev.y;

            if (dx !== 0 || dy !== 0) {
                moveSelectedShapes({ x: dx, y: dy });
            }
        }

        previous.current = { x: current.x, y: current.y };
    }, [current.x, current.y, dragging, moveSelectedShapes]);

    return null;
};

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
