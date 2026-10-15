import * as alignment from 'src/app/alignment';
import * as clipboard from 'src/app/clipboard';
import * as operations from 'src/app/operationBatches';
import { provideEditorHelpers } from 'src/app/editorHelpers';
import * as snapping from 'src/app/snapping';
import {
    AlignBottomCommand,
    AlignCenterCommand,
    AlignLeftCommand,
    AlignMiddleCommand,
    AlignRightCommand,
    AlignTopCommand,
    SpaceBetweenHorizontallyCommand,
    SpaceBetweenVerticallyCommand,
    SpaceEquallyHorizontallyCommand,
    SpaceEquallyVerticallyCommand,
    BringToFrontCommand,
    CloneCommand,
    CopyCommand,
    CreateComponentCommand,
    LeaveComponentSourceCommand,
    DetachInstanceCommand,
    CutCommand,
    DeleteCommand,
    EditWithWordsCommand,
    GroupCommand,
    HideCommand,
    HighlightLayerCommand,
    LayerCommand,
    LockCommand,
    MoveDownCommand,
    MoveLeftCommand,
    MoveRightCommand,
    MoveUpCommand,
    NewLayerCommand,
    PasteCommand,
    RedoCommand,
    RemoveFromGroupCommand,
    ResetDocumentCommand,
    SendToBackCommand,
    SelectComponentSourceCommand,
    ResetComponentOverridesCommand,
    ShowAllCommand,
    UndoCommand,
    UngroupCommand,
    UnlayerCommand,
    UnlockCommand,
    ZoomInCommand,
    ZoomOutCommand,
    ZoomResetCommand
} from 'src/commands';

import {
    CircleTool,
    EllipseTool,
    ImageTool,
    InstanceTool,
    LineTool,
    MoveTool,
    PenTool,
    RectTool,
    SelectTool,
    TextTool
} from 'src/tools';
import { registerCommand, registerTool } from 'src/app/actions/startup';

function registerCommands() {
    registerCommand(UndoCommand);
    registerCommand(RedoCommand);
    registerCommand(DeleteCommand);
    registerCommand(MoveLeftCommand);
    registerCommand(MoveRightCommand);
    registerCommand(MoveUpCommand);
    registerCommand(MoveDownCommand);
    registerCommand(CloneCommand);
    registerCommand(CreateComponentCommand);
    registerCommand(LeaveComponentSourceCommand);
    registerCommand(SelectComponentSourceCommand);
    registerCommand(ResetComponentOverridesCommand);
    registerCommand(DetachInstanceCommand);
    registerCommand(CopyCommand);
    registerCommand(CutCommand);
    registerCommand(PasteCommand);
    registerCommand(GroupCommand);
    registerCommand(UngroupCommand);
    registerCommand(RemoveFromGroupCommand);
    registerCommand(LayerCommand);
    registerCommand(NewLayerCommand);
    registerCommand(UnlayerCommand);
    registerCommand(HighlightLayerCommand);
    registerCommand(AlignLeftCommand);
    registerCommand(AlignCenterCommand);
    registerCommand(AlignRightCommand);
    registerCommand(AlignTopCommand);
    registerCommand(AlignMiddleCommand);
    registerCommand(AlignBottomCommand);
    registerCommand(SpaceBetweenHorizontallyCommand);
    registerCommand(SpaceBetweenVerticallyCommand);
    registerCommand(SpaceEquallyHorizontallyCommand);
    registerCommand(SpaceEquallyVerticallyCommand);
    registerCommand(BringToFrontCommand);
    registerCommand(SendToBackCommand);
    registerCommand(HideCommand);
    registerCommand(ShowAllCommand);
    registerCommand(LockCommand);
    registerCommand(UnlockCommand);
    registerCommand(ZoomInCommand);
    registerCommand(ZoomOutCommand);
    registerCommand(ZoomResetCommand);
    registerCommand(ResetDocumentCommand);
    registerCommand(EditWithWordsCommand);
}

function registerTools() {
    registerTool(CircleTool);
    registerTool(EllipseTool);
    registerTool(ImageTool);
    registerTool(InstanceTool);
    registerTool(LineTool);
    registerTool(MoveTool);
    registerTool(PenTool);
    registerTool(RectTool);
    registerTool(SelectTool);
    registerTool(TextTool);
}

/**
 * Registers the editor's commands and tools, in the order the command bar and the
 * tool bar list them, and provides the helpers its actions run. They load with the
 * editor page, not at startup, so the other pages open without them; registering
 * again changes nothing.
 */
export function registerEditor() {
    registerCommands();
    registerTools();
    provideEditorHelpers({ alignment, clipboard, operations, snapping });
}
