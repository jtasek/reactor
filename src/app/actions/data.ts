import type { ActionWithParamAndResult } from '../types';
import type { DataEdit, DataEditResult } from '../dataEdits';
import { editorHelpers } from '../editorHelpers';

export const editData: ActionWithParamAndResult<DataEdit, DataEditResult> = (context, edit) =>
    editorHelpers().data.editData(context, edit);
