import { Command } from 'src/app/types';
import { editableSelectedShapesIds } from 'src/app/membership';

import { Context } from '../../app';

export const deleteSelectedShapes = ({ state, actions }: Context) => {
    const { selectedShapesIds } = state.currentDocument;

    actions.removeShapes([...selectedShapesIds]);
};

export const DeleteCommand: Command = {
    id: 'delete',
    name: 'Delete',
    category: 'tools',
    description: 'Delete selected shapes',
    icon: {
        group: 'action',
        name: 'delete',
        size: 24
    },
    regex: /(?<toolCode>delete)\('(?<shapeName>\w+)'\)/,
    shortcut: 'delete,backspace',
    scopes: ['shape', 'group', 'selection'],
    menuOrder: 20,
    canExecute: ({ state }) => editableSelectedShapesIds(state.currentDocument).length > 0,
    execute: deleteSelectedShapes
};
