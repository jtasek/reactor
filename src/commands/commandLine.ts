import { Command as CommandIcon } from 'lucide-react';
import type { Command } from 'src/app/types';
import { takesEditorInput } from 'src/events/input';

export const OpenCommandLineCommand: Command = {
    id: 'open-command-line',
    name: 'Open Command Line',
    category: 'document',
    description: 'Search actions and edit the selection by name',
    icon: { component: CommandIcon, size: 24 },
    shortcut: 'mod+k',
    places: [],
    canExecute: ({ state }) => takesEditorInput(state),
    execute: ({ actions }) => actions.ui.showControl('commandLine')
};
