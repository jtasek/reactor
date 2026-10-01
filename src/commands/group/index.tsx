import { Command } from 'src/app/types';
import { GROUP_MINIMUM, editableSelectedShapesIds } from 'src/app/membership';

export const GroupCommand: Command = {
    id: 'group',
    name: 'Group',
    category: 'groups',
    description: 'Group selected shapes',
    icon: {
        group: 'av',
        name: 'library_add',
        size: 24
    },
    shortcut: 'mod+g',
    canExecute: ({ state }) =>
        editableSelectedShapesIds(state.currentDocument).length >= GROUP_MINIMUM,
    execute: ({ actions }) => actions.groupSelection()
};

export const UngroupCommand: Command = {
    id: 'ungroup',
    name: 'Ungroup',
    category: 'groups',
    description: 'Ungroup selected groups',
    icon: {
        group: 'av',
        name: 'library_books',
        size: 24
    },
    shortcut: 'mod+shift+g',
    canExecute: ({ state }) =>
        state.currentDocument.selectedGroupsIds.some(
            (id) => !state.currentDocument.groups[id].locked
        ),
    execute: ({ actions }) => actions.ungroupSelection()
};
