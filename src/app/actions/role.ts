import type { editRole as edit } from '../roleEdits';
import { editorHelpers } from '../editorHelpers';

export const editRole: typeof edit = (context, input) =>
    editorHelpers().roles.editRole(context, input);
