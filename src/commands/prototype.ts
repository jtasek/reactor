import { MonitorPlay } from 'lucide-react';
import type { Command } from 'src/app/types';
import { takesEditorInput } from 'src/events/input';

export const OpenPrototypeCommand: Command = {
    id: 'open-prototype',
    name: 'Open prototype',
    category: 'document',
    description: 'Run the application in a separate prototype session',
    icon: { component: MonitorPlay, size: 24 },
    places: [],
    canExecute: ({ state }) => takesEditorInput(state),
    execute: ({ effects }) => effects.navigate('/prototype')
};
