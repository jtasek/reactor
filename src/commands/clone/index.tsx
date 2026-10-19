import { Copy } from 'lucide-react';
import { Command } from 'src/app/types';
import { Context } from 'src/app';

export const cloneSelection = ({ state, actions }: Context) => {
    const id = state.currentDocument.selectedFrameId;

    if (id) {
        actions.editFrame({ kind: 'clone', id });

        return;
    }

    actions.cloneShapes(state.currentDocument.selectedShapesIds);
};

export const CloneCommand: Command = {
    id: 'clone',
    name: 'Clone',
    category: 'tools',
    description: 'Clone current selection',
    icon: {
        component: Copy,
        size: 24
    },
    regex: /(?<toolCode>clone)\('(?<shapeName>\w+)'\)/,
    shortcut: 'mod+d',
    scopes: ['shape', 'group', 'selection'],
    menuOrder: 10,
    canExecute: ({ state }) =>
        Boolean(
            state.currentDocument.selectedFrameId &&
            !state.currentDocument.locked &&
            !state.currentDocument.frames[state.currentDocument.selectedFrameId]?.locked
        ) || state.currentDocument?.selectedShapesIds.length > 0,
    execute: cloneSelection
};
