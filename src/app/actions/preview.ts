import type { Action } from '../types';
import { takesEditorInput } from 'src/events/input';
import { editorHelpers } from '../editorHelpers';

export const togglePreview: Action = ({ state }) => {
    if (!takesEditorInput(state)) {
        return;
    }
    state.previewDocumentId =
        state.previewDocumentId === state.currentDocumentId ? null : state.currentDocumentId;
    state.previewModeContext = state.previewDocumentId
        ? editorHelpers().dimensions.previewModes(state)
        : null;
};

export const closePreview: Action = ({ state }) => {
    state.previewDocumentId = null;
    state.previewModeContext = null;
};
