import { Command } from 'src/app/types';
import { Context } from '../../app';

export const cloneSelection = ({ state, actions }: Context) => {
    [...state.currentDocument.selectedShapesIds].forEach((shapeId) => actions.cloneShape(shapeId));
};

export const CloneCommand: Command = {
    id: 'clone',
    name: 'Clone',
    category: 'tools',
    description: 'Clone current selection',
    icon: {
        group: 'content',
        name: 'content_copy',
        size: 24
    },
    regex: /(?<toolCode>clone)\('(?<shapeName>\w+)'\)/,
    shortcut: 'ctrl+v',
    canExecute: ({ state }) => state.currentDocument?.selectedShapesIds.length > 0,
    execute: cloneSelection
};
