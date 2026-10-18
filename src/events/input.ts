import { isReadOnly } from '../app/documentAccess';
import type { Context } from '../app';
import { editorLoaded } from '../app/editorHelpers';

/**
 * Whether the editor takes shortcuts and the clipboard now: in the designer, once
 * its code has loaded, while not typing or dragging.
 */
export const takesEditorInput = (state: Context['state']) =>
    !isReadOnly(state) && acceptsInput(state);

const acceptsInput = ({ currentPage, events, resetDocumentId }: Context['state']) =>
    currentPage === 'designer' &&
    editorLoaded() &&
    !events.keyboard.typing &&
    !events.pointer.dragging &&
    !resetDocumentId;
