import { takesEditorInput } from 'src/events/input';
import type { Context } from '../index';
import type { Action } from '../types';

/**
 * Opens the chat asking AI to change the current document, where AI is available: in its
 * panel, or in the bar over the canvas. The conversation moves between the two.
 */
export const requestAiEdit = ({ state }: Context, view: 'panel' | 'bar' = 'panel') => {
    // The entries that call this check the workspace's AI switch too (`aiOffered`).
    if (state.ai !== 'unavailable' && takesEditorInput(state) && !state.currentDocument.locked) {
        state.aiEditDocumentId = state.currentDocumentId;
        state.aiEditView = view;
    }
};

export const closeAiEdit: Action = ({ state }) => {
    state.aiEditDocumentId = null;
};
