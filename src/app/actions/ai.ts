import { takesEditorInput } from 'src/events/input';
import type { Action } from '../types';

/** Opens the chat asking AI to change the current document, where AI is available. */
export const requestAiEdit: Action = ({ state }) => {
    if (state.ai === 'available' && takesEditorInput(state) && !state.currentDocument.locked) {
        state.aiEditDocumentId = state.currentDocumentId;
    }
};

export const closeAiEdit: Action = ({ state }) => {
    state.aiEditDocumentId = null;
};
