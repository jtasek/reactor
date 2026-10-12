import React, { FC } from 'react';
import type { Tool } from 'src/tools/types';
import { useComponentSource, usePointer, useAppState } from 'src/app/hooks';

const DesignInstance: FC = () => {
    const pointer = usePointer();
    const componentId = useAppState((state) => state.tools.componentToPlace ?? null);
    const source = useComponentSource(componentId);

    if (!pointer.dragging || !source) {
        return null;
    }

    return (
        <rect
            x={pointer.start.x}
            y={pointer.start.y}
            width={source.box.width}
            height={source.box.height}
            fill="none"
            stroke="currentColor"
            strokeDasharray="4 3"
            pointerEvents="none"
        />
    );
};

export const InstanceTool: Tool = {
    id: 'instance',
    name: 'Insert instance',
    category: 'shapes',
    description: 'Place an instance of the chosen component',
    icon: { group: 'content', name: 'library_add', size: 24 },
    designComponent: DesignInstance,
    canExecute: ({ state }) =>
        Boolean(
            state.tools.componentToPlace &&
            state.currentDocument.components[state.tools.componentToPlace]
        ),
    execute: ({ state, actions }) => {
        const componentId = state.tools.componentToPlace;

        if (!componentId) {
            return;
        }
        actions.insertComponentAt({ componentId, position: state.events.pointer.start });
    },
    shouldDeactivate: () => true
};
