import { Command } from 'src/app/types';

import { Context } from '../../app';

export const panSelection = (Context: Context, arg?: Record<string, unknown>) => {
    console.log('TODO: Implement pan tool');
};

export const PanCommand: Command = {
    id: 'pan',
    name: 'Pan',
    category: 'tools',
    description: 'Move canvas',
    icon: {
        group: 'action',
        name: 'open_with',
        size: 24
    },
    regex: /(?<toolCode>pan)\((?<x>\d+),(?<y>\d+)\)/,
    shortcut: 'm',
    canExecute: (context: Context) => true,
    execute: panSelection
};
