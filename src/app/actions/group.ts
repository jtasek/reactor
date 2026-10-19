import type { Action, ActionWithParam, Group, ResizeHandlerType } from '../types';
import type { GroupDrag } from '../groupEdits';
import { editorHelpers } from '../editorHelpers';
export type { GroupDrag } from '../groupEdits';

/** Group edits are provided by the editor page, alongside frame edits. */
export const addGroup: ActionWithParam<Partial<Group>> = (context, input) =>
    editorHelpers().groups.addGroup(context, input);

export const cloneGroup: ActionWithParam<string> = (context, input) =>
    editorHelpers().groups.cloneGroup(context, input);

export const removeGroup: ActionWithParam<string> = (context, input) =>
    editorHelpers().groups.removeGroup(context, input);

export const groupSelection: Action = (context) => editorHelpers().groups.groupSelection(context);

export const addShapesToGroup: ActionWithParam<{ shapeIds: string[]; groupId: string }> = (
    context,
    input
) => editorHelpers().groups.addShapesToGroup(context, input);

export const ungroupSelection: Action = (context) =>
    editorHelpers().groups.ungroupSelection(context);

export const removeSelectionFromGroups: Action = (context) =>
    editorHelpers().groups.removeSelectionFromGroups(context);

export const toggleGroupSelected: ActionWithParam<string> = (context, input) =>
    editorHelpers().groups.toggleGroupSelected(context, input);

export const unselectGroup: ActionWithParam<string> = (context, input) =>
    editorHelpers().groups.unselectGroup(context, input);

export const toggleGroupLocked: ActionWithParam<string> = (context, input) =>
    editorHelpers().groups.toggleGroupLocked(context, input);

export const lockGroup: ActionWithParam<string> = (context, input) =>
    editorHelpers().groups.lockGroup(context, input);

export const unlockGroup: ActionWithParam<string> = (context, input) =>
    editorHelpers().groups.unlockGroup(context, input);

export const showGroup: ActionWithParam<string> = (context, input) =>
    editorHelpers().groups.showGroup(context, input);

export const hideGroup: ActionWithParam<string> = (context, input) =>
    editorHelpers().groups.hideGroup(context, input);

export const toggleGroupVisible: ActionWithParam<string> = (context, input) =>
    editorHelpers().groups.toggleGroupVisible(context, input);

export const updateGroup: ActionWithParam<Partial<Group> & { id: string }> = (context, input) =>
    editorHelpers().groups.updateGroup(context, input);

export const rotateGroup: ActionWithParam<GroupDrag> = (context, input) =>
    editorHelpers().groups.rotateGroup(context, input);

export const resizeGroup: ActionWithParam<GroupDrag & { handle: ResizeHandlerType }> = (
    context,
    input
) => editorHelpers().groups.resizeGroup(context, input);
