import type { Context } from '../app';
import { editorLoaded } from '../app/editorHelpers';

/**
 * Whether the editor takes shortcuts and the clipboard now: in the designer, once
 * its code has loaded, while not typing or dragging.
 */
export const takesEditorInput = ({
    currentPage,
    events,
    resetDocumentId,
    aiEditDocumentId
}: Context['state']) =>
    currentPage === 'designer' &&
    editorLoaded() &&
    !events.keyboard.typing &&
    !events.pointer.dragging &&
    !resetDocumentId &&
    !aiEditDocumentId;
