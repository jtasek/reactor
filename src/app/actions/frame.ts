import type { ActionWithParamAndResult } from '../types';
import type { FrameEdit } from '../frameEdits';
import { editorHelpers } from '../editorHelpers';

/** Frame editing loads with the editor, not the application entry. */
export const editFrame: ActionWithParamAndResult<FrameEdit, string | undefined> = (context, edit) =>
    editorHelpers().frames.edit(context, edit);
