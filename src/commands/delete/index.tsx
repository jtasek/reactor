import { Command } from 'src/app/types';
import { editableSelectedShapesIds } from 'src/app/membership';

import { Context } from '../../app';

export const deleteSelectedShapes = ({ state, actions }: Context) => {
    const { selectedShapesIds } = state.currentDocument;

    [...selectedShapesIds].forEach((shapeId) => actions.removeShape(shapeId));
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
    canExecute: ({ state }) => editableSelectedShapesIds(state.currentDocument).length > 0,
    execute: deleteSelectedShapes
};
