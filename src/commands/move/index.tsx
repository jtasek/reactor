import { Command } from 'src/app/types';
import { Context } from 'src/app/hooks';

export const moveSelection = (Context: Context, arg?: Record<string, unknown>) => {
  console.log('TODO: Implement moveSelection');
};

export const MoveCommand: Command = {
  id: 'move',
  name: 'Move',
  category: 'shapes',
  description: 'Move current selection',
  icon: {
    group: 'action',
    name: 'open_with',
    size: 24
  },
  factory: ({ state }: Context) => {
    return {};
  },
  regex: /(?<toolCode>move)\('(?<shapeName>\w+)',(?<x>\d+),(?<y>\d+)\)/,
  shortcut: 'm',
  canExecute: (context: Context) => true,
  execute: moveSelection
};
