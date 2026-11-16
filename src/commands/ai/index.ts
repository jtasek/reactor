import { Sparkles } from 'lucide-react';
import type { Command } from 'src/app/types';
import { takesEditorInput } from 'src/events/input';
import { aiOffered } from 'src/app/aiAccess';

export const EditWithWordsCommand: Command = {
    id: 'edit-with-words',
    name: 'Edit with words',
    category: 'ai',
    description: 'Describe a change and review what AI proposes before it is made',
    icon: {
        component: Sparkles,
        size: 24
    },
    shortcut: 'w',
    // Offered on the application bar, and only where AI is available and the workspace leaves it on.
    places: [],
    canExecute: ({ state }) =>
        aiOffered(state) && takesEditorInput(state) && !state.currentDocument.locked,
    execute: ({ actions }) => actions.requestAiEdit()
};
