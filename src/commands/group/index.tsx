import { Group, Ungroup, CircleMinus } from 'lucide-react';
import { Command } from 'src/app/types';
import { GROUP_MINIMUM, groupedShapesSelectedAlone } from 'src/app/membership';

export const GroupCommand: Command = {
    id: 'group',
    name: 'Group',
    category: 'groups',
    description: 'Group selected shapes',
    icon: {
        component: Group,
        size: 24
    },
    shortcut: 'mod+g',
    scopes: ['selection'],
    menuOrder: 50,
    canExecute: ({ state }) =>
        state.currentDocument.editableSelectedShapesIds.length >= GROUP_MINIMUM,
    execute: ({ actions }) => actions.groupSelection()
};

export const UngroupCommand: Command = {
    id: 'ungroup',
    name: 'Ungroup',
    category: 'groups',
    description: 'Ungroup selected groups',
    icon: {
        component: Ungroup,
        size: 24
    },
    shortcut: 'mod+shift+g',
    scopes: ['group', 'selection'],
    menuOrder: 5,
    canExecute: ({ state }) =>
        state.currentDocument.selectedGroupsIds.some(
            (id) => !state.currentDocument.groups[id].locked
        ),
    execute: ({ actions }) => actions.ungroupSelection()
};

export const RemoveFromGroupCommand: Command = {
    id: 'remove-from-group',
    name: 'Remove from group',
    category: 'groups',
    description: 'Remove selected shapes from their group',
    icon: {
        component: CircleMinus,
        size: 24
    },
    shortcut: 'mod+alt+g',
    canExecute: ({ state }) => groupedShapesSelectedAlone(state.currentDocument).length > 0,
    execute: ({ actions }) => actions.removeSelectionFromGroups()
};
