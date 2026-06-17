import { Command } from 'src/app/types';
import { isShapeLocked } from 'src/app/utils';

import { Context } from '../../app';

export const deleteSelectedShapes = ({ state }: Context) => {
    const { selectedShapesIds } = state.currentDocument;

    selectedShapesIds?.forEach((shapeId: string) => {
        if (isShapeLocked(state.currentDocument, shapeId)) {
            return;
        }

        delete state.currentDocument.shapes[shapeId];
    });
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
    shortcut: 'm',
    canExecute: ({ state }: Context) => state.currentDocument?.selectedShapes.length > 0,
    execute: deleteSelectedShapes
};
