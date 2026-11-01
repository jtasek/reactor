import { Workflow } from 'lucide-react';
import type { Command } from 'src/app/types';
import { takesEditorInput } from 'src/events/input';

export const OpenFlowCommand: Command = {
    id: 'open-flow',
    name: 'Open flow',
    category: 'document',
    description: 'Connect screens and edit navigation actions',
    icon: { component: Workflow, size: 24 },
    places: [],
    canExecute: ({ state }) => takesEditorInput(state),
    execute: ({ effects }) => effects.navigate('/flow')
};
