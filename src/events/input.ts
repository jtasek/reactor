import type { Context } from '../app';

/** Whether the editor takes shortcuts and the clipboard now: in the designer, while not typing or dragging. */
export const takesEditorInput = ({ currentPage, events }: Context['state']) =>
    currentPage === 'designer' && !events.keyboard.typing && !events.pointer.dragging;
