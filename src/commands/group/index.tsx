import { Command } from 'src/app/types';
import { Context } from 'src/app/hooks';
import { createGroup } from 'src/app/factories';

export const groupSelection = (context: Context) => {
  const { state } = context;

  const group = createGroup({ shapesIds: state.currentDocument?.selectedShapesIds });

  state.currentDocument.groups[group.id] = group;
};

export const GroupCommand: Command = {
  id: 'group',
  name: 'Group',
  description: 'Group current selection',
  icon: {
    group: 'av',
    name: 'library_add',
    size: 24
  },
  regex: /(?<toolCode>group)\('(?<shapeName>\w+)',(?<x>\d+),(?<y>\d+)\)/,
  shortcut: 'm',
  canExecute: ({ state }: Context) => state.currentDocument?.selectedShapes.length > 0,
  execute: groupSelection
};

export const deleteSelectedGroups = ({ state }: Context) => {
  const { selectedGroupsIds } = state.currentDocument;

  selectedGroupsIds?.forEach((groupId) => delete state.currentDocument.groups[groupId]);
};

export const UngroupCommand: Command = {
  id: 'ungroup',
  name: 'Ungroup',
  description: 'Delete selected group',
  icon: {
    group: 'av',
    name: 'library_books',
    size: 24
  },
  regex: /(?<toolCode>group)\('(?<shapeName>\w+)',(?<x>\d+),(?<y>\d+)\)/,
  shortcut: 'm',
  canExecute: ({ state }: Context) => state.currentDocument.selectedGroupsIds.length > 0,
  execute: deleteSelectedGroups
};
