import { Command, CommandGuard } from 'src/app/types';
import { hasHidden, selectedItems } from 'src/app/membership';

const selects =
    (locked: boolean): CommandGuard =>
    ({ state }) => {
        const { groups, shapes } = selectedItems(state.currentDocument);

        return [...groups, ...shapes].some((item) => item.locked === locked);
    };

export const HideCommand: Command = {
    id: 'hide',
    name: 'Hide',
    category: 'visibility',
    description: 'Hide selected shapes and groups',
    icon: {
        group: 'action',
        name: 'visibility_off',
        size: 24
    },
    shortcut: 'shift+h',
    canExecute: ({ state }) => state.currentDocument.selectedShapesIds.length > 0,
    execute: ({ actions }) => actions.hideSelection()
};

export const ShowAllCommand: Command = {
    id: 'show-all',
    name: 'Show all',
    category: 'visibility',
    description: 'Show every hidden shape, group and layer',
    icon: {
        group: 'action',
        name: 'visibility',
        size: 24
    },
    shortcut: 'alt+shift+h',
    canExecute: ({ state }) => hasHidden(state.currentDocument),
    execute: ({ actions }) => actions.showAll()
};

export const LockCommand: Command = {
    id: 'lock',
    name: 'Lock',
    category: 'visibility',
    description: 'Lock selected shapes and groups, so they cannot be changed',
    icon: {
        group: 'action',
        name: 'lock',
        size: 24
    },
    shortcut: 'k',
    canExecute: selects(false),
    execute: ({ actions }) => actions.lockSelection()
};

export const UnlockCommand: Command = {
    id: 'unlock',
    name: 'Unlock',
    category: 'visibility',
    description: 'Unlock selected shapes and groups',
    icon: {
        group: 'action',
        name: 'lock_open',
        size: 24
    },
    shortcut: 'shift+k',
    canExecute: selects(true),
    execute: ({ actions }) => actions.unlockSelection()
};
