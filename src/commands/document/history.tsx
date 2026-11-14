import { History } from 'lucide-react';
import type { Command } from 'src/app/types';
import { takesEditorInput } from 'src/events/input';

const HISTORY_ICON_SIZE = 24;

export const DocumentHistoryCommand: Command = {
    id: 'document-history',
    name: 'Document history',
    category: 'document',
    description: 'See and restore earlier versions the server keeps',
    icon: {
        component: History,
        size: HISTORY_ICON_SIZE
    },
    // Only a document on the server, which this person may edit there, has history to restore.
    canExecute: ({ state }) =>
        state.account.kind === 'signedIn' &&
        ['editor', 'admin'].includes(state.documentAccess[state.currentDocumentId]?.role) &&
        takesEditorInput(state),
    execute: ({ actions }) => actions.openDocumentHistory()
};
