import { EyeOff, Eye, Lock, LockOpen } from 'lucide-react';
import { Command, CommandGuard } from 'src/app/types';
import { hasHidden } from 'src/app/membership';
import { flagEditableItems } from 'src/app/visibilityEdits';

const selects =
    (locked: boolean): CommandGuard =>
    ({ state }) => {
        const { groups, shapes } = flagEditableItems(state.currentDocument);

        return [...groups, ...shapes].some((item) => item.locked === locked);
    };

export const HideCommand: Command = {
    id: 'hide',
    name: 'Hide',
    category: 'visibility',
    description: 'Hide selected shapes and groups',
    icon: {
        component: EyeOff,
        size: 24
    },
    shortcut: 'shift+h',
    canExecute: ({ state }) =>
        Object.values(flagEditableItems(state.currentDocument)).some((items) => items.length > 0),
    execute: ({ actions }) => actions.hideSelection()
};

export const ShowAllCommand: Command = {
    id: 'show-all',
    name: 'Show all',
    category: 'visibility',
    description: 'Show every hidden shape, group, layer and frame',
    icon: {
        component: Eye,
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
        component: Lock,
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
        component: LockOpen,
        size: 24
    },
    shortcut: 'shift+k',
    canExecute: selects(true),
    execute: ({ actions }) => actions.unlockSelection()
};
