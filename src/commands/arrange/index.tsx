import { Command } from 'src/app/types';
import { editableSelectedShapesIds } from 'src/app/membership';

export const BringToFrontCommand: Command = {
    id: 'bring-to-front',
    name: 'Bring to front',
    category: 'arrange',
    description: 'Draw selected shapes over all others',
    icon: {
        group: 'action',
        name: 'flip_to_front',
        size: 24
    },
    shortcut: ']',
    canExecute: ({ state }) => editableSelectedShapesIds(state.currentDocument).length > 0,
    execute: ({ actions }) => actions.bringSelectionToFront()
};

export const SendToBackCommand: Command = {
    id: 'send-to-back',
    name: 'Send to back',
    category: 'arrange',
    description: 'Draw selected shapes under all others',
    icon: {
        group: 'action',
        name: 'flip_to_back',
        size: 24
    },
    shortcut: '[',
    canExecute: ({ state }) => editableSelectedShapesIds(state.currentDocument).length > 0,
    execute: ({ actions }) => actions.sendSelectionToBack()
};
