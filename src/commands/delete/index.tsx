import { isFrameLocked } from 'src/app/frameState';
import { Trash2 } from 'lucide-react';
import { Command } from 'src/app/types';

import { Context } from 'src/app';

export const deleteSelectedShapes = ({ state, actions }: Context) => {
    const { selectedShapesIds } = state.currentDocument;

    actions.removeShapes([...selectedShapesIds]);
    actions.removeSelectedGuides();
    const id = state.currentDocument.selectedFrameId;

    if (id) {
        actions.editFrame({ kind: 'delete', id });
    }
};

export const DeleteCommand: Command = {
    id: 'delete',
    name: 'Delete',
    category: 'tools',
    description: 'Delete selected shapes or guides',
    icon: {
        component: Trash2,
        size: 24
    },
    regex: /(?<toolCode>delete)\('(?<shapeName>\w+)'\)/,
    shortcut: 'delete,backspace',
    scopes: ['shape', 'group', 'selection'],
    menuOrder: 20,
    canExecute: ({ state }) =>
        Boolean(
            state.currentDocument.selectedFrameId &&
            !isFrameLocked(state.currentDocument, state.currentDocument.selectedFrameId)
        ) ||
        state.currentDocument.editableSelectedShapesIds.length > 0 ||
        (!state.currentDocument.locked &&
            state.ui.guides.visible &&
            Object.values(state.currentDocument.guides).some(
                (guide) => guide.selected && guide.visible && !guide.locked
            )),
    execute: deleteSelectedShapes
};
