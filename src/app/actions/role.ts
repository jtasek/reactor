import type { editInteractions as editActions } from '../interactionEdits';
import type { editRole as edit } from '../roleEdits';
import { editorHelpers } from '../editorHelpers';

export const editRole: typeof edit = (context, input) =>
    editorHelpers().roles.editRole(context, input);

export const editInteractions: typeof editActions = (context, input) =>
    editorHelpers().roles.editInteractions(context, input);
