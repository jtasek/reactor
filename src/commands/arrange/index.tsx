import { Command } from 'src/app/types';

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
    scopes: ['shape', 'group', 'selection'],
    menuOrder: 30,
    canExecute: ({ state }) => state.currentDocument.editableSelectedShapesIds.length > 0,
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
    scopes: ['shape', 'group', 'selection'],
    menuOrder: 40,
    canExecute: ({ state }) => state.currentDocument.editableSelectedShapesIds.length > 0,
    execute: ({ actions }) => actions.sendSelectionToBack()
};
