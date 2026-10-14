import { Trash2 } from 'lucide-react';
import type { Command } from 'src/app/types';
import { takesEditorInput } from 'src/events/input';

const RESET_ICON_SIZE = 24;

export const ResetDocumentCommand: Command = {
    id: 'reset-document',
    name: 'Reset document',
    category: 'document',
    description: 'Remove all content from the current document',
    icon: {
        component: Trash2,
        size: RESET_ICON_SIZE
    },
    canExecute: ({ state }) => takesEditorInput(state) && !state.currentDocument.locked,
    execute: ({ actions }) => actions.requestDocumentReset()
};
