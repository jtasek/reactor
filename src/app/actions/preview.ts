import type { Action } from '../types';
import { takesEditorInput } from 'src/events/input';

export const togglePreview: Action = ({ state }) => {
    if (!takesEditorInput(state)) {
        return;
    }
    state.previewDocumentId =
        state.previewDocumentId === state.currentDocumentId ? null : state.currentDocumentId;
};

export const closePreview: Action = ({ state }) => {
    state.previewDocumentId = null;
};
