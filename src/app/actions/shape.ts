import type * as ShapeEdits from '../shapeEdits';
import { editorHelpers } from '../editorHelpers';
import { takesEditorInput } from 'src/events/input';
import type { ActionWithResult, ActionWithParamAndResult } from '../types';
import type { Cut } from '../services/clipboard';
import type { PasteResult } from '../clipboard';

/** Shape editing loads with the editor; read-only previews use the layout projection. */
export const addShape: typeof ShapeEdits.addShape = (context, input) =>
    editorHelpers().shapes.addShape(context, input);

export const drawShape: typeof ShapeEdits.drawShape = (context, input) =>
    editorHelpers().shapes.drawShape(context, input);

export const cloneShapes: typeof ShapeEdits.cloneShapes = (context, input) =>
    editorHelpers().shapes.cloneShapes(context, input);

export const copySelection: ActionWithResult<string | null> = (context) =>
    takesEditorInput(context.state) ? editorHelpers().clipboardEdits.copySelection(context) : null;

export const selectionToCut: ActionWithResult<Cut | null> = (context) =>
    takesEditorInput(context.state) ? editorHelpers().clipboardEdits.selectionToCut(context) : null;

export const removeShapes: typeof ShapeEdits.removeShapes = (context, input) =>
    editorHelpers().shapes.removeShapes(context, input);

export const detachInstances: typeof ShapeEdits.detachInstances = (context, input) =>
    editorHelpers().shapes.detachInstances(context, input);

export const pasteShapes: ActionWithParamAndResult<string, PasteResult> = (context, text) =>
    takesEditorInput(context.state)
        ? editorHelpers().clipboardEdits.pasteShapes(context, text)
        : 'notNow';

export const bringShapesToFront: typeof ShapeEdits.bringShapesToFront = (context, input) =>
    editorHelpers().shapes.bringShapesToFront(context, input);

export const sendShapesToBack: typeof ShapeEdits.sendShapesToBack = (context, input) =>
    editorHelpers().shapes.sendShapesToBack(context, input);

export const removeShape: typeof ShapeEdits.removeShape = (context, input) =>
    editorHelpers().shapes.removeShape(context, input);

export const toggleShapeSelected: typeof ShapeEdits.toggleShapeSelected = (context, input) =>
    editorHelpers().shapes.toggleShapeSelected(context, input);

export const selectShape: typeof ShapeEdits.selectShape = (context, input) =>
    editorHelpers().shapes.selectShape(context, input);

export const selectShapeByPoint: typeof ShapeEdits.selectShapeByPoint = (context) =>
    editorHelpers().shapes.selectShapeByPoint(context);

export const enterGroupAtPointer: typeof ShapeEdits.enterGroupAtPointer = (context) =>
    editorHelpers().shapes.enterGroupAtPointer(context);

export const enterClickedGroup: typeof ShapeEdits.enterClickedGroup = (context, input) =>
    editorHelpers().shapes.enterClickedGroup(context, input);

export const selectContextMenuTarget: typeof ShapeEdits.selectContextMenuTarget = (
    context,
    input
) => editorHelpers().shapes.selectContextMenuTarget(context, input);

export const selectShapeAtPointer: typeof ShapeEdits.selectShapeAtPointer = (context) =>
    editorHelpers().shapes.selectShapeAtPointer(context);

export const moveShapesBy: typeof ShapeEdits.moveShapesBy = (context, input) =>
    editorHelpers().shapes.moveShapesBy(context, input);

export const moveSelectedShapes: typeof ShapeEdits.moveSelectedShapes = (context, input) =>
    editorHelpers().shapes.moveSelectedShapes(context, input);

export const selectClickedShapes: typeof ShapeEdits.selectClickedShapes = (context) =>
    editorHelpers().shapes.selectClickedShapes(context);

export const selectShapes: typeof ShapeEdits.selectShapes = (context) =>
    editorHelpers().shapes.selectShapes(context);

export const setShapeBounds: typeof ShapeEdits.setShapeBounds = (context, input) =>
    editorHelpers().shapes.setShapeBounds(context, input);

export const unselectShapes: typeof ShapeEdits.unselectShapes = (context) =>
    editorHelpers().shapes.unselectShapes(context);

export const unselectShape: typeof ShapeEdits.unselectShape = (context, input) =>
    editorHelpers().shapes.unselectShape(context, input);

export const activateShape: typeof ShapeEdits.activateShape = (context, input) =>
    editorHelpers().shapes.activateShape(context, input);

export const deactivateShape: typeof ShapeEdits.deactivateShape = (context, input) =>
    editorHelpers().shapes.deactivateShape(context, input);

export const lockShape: typeof ShapeEdits.lockShape = (context, input) =>
    editorHelpers().shapes.lockShape(context, input);

export const toggleShapeLocked: typeof ShapeEdits.toggleShapeLocked = (context, input) =>
    editorHelpers().shapes.toggleShapeLocked(context, input);

export const toggleShapeVisible: typeof ShapeEdits.toggleShapeVisible = (context, input) =>
    editorHelpers().shapes.toggleShapeVisible(context, input);

export const unlockShape: typeof ShapeEdits.unlockShape = (context, input) =>
    editorHelpers().shapes.unlockShape(context, input);

export const showShape: typeof ShapeEdits.showShape = (context, input) =>
    editorHelpers().shapes.showShape(context, input);

export const hideShape: typeof ShapeEdits.hideShape = (context, input) =>
    editorHelpers().shapes.hideShape(context, input);

export const updateShape: typeof ShapeEdits.updateShape = (context, input) =>
    editorHelpers().shapes.updateShape(context, input);

export const setShapesProperty: typeof ShapeEdits.setShapesProperty = (context, input) =>
    editorHelpers().shapes.setShapesProperty(context, input);

export const resizeShape: typeof ShapeEdits.resizeShape = (context, input) =>
    editorHelpers().shapes.resizeShape(context, input);

export const roundCorners: typeof ShapeEdits.roundCorners = (context, input) =>
    editorHelpers().shapes.roundCorners(context, input);

export const rotateShape: typeof ShapeEdits.rotateShape = (context, input) =>
    editorHelpers().shapes.rotateShape(context, input);
