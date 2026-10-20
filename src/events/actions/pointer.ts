import type * as PointerEdits from '../pointerEdits';
import { editorHelpers, editorLoaded } from 'src/app/editorHelpers';

/** Gesture implementations load with the editor; account changes may cancel before it loads. */
export const setStartPosition: typeof PointerEdits.setStartPosition = (context, input) =>
    editorHelpers().pointer.setStartPosition(context, input);

export const setCurrentPosition: typeof PointerEdits.setCurrentPosition = (context, input) =>
    editorHelpers().pointer.setCurrentPosition(context, input);

export const updatePath: typeof PointerEdits.updatePath = (context, input) =>
    editorHelpers().pointer.updatePath(context, input);

export const beginGesture: typeof PointerEdits.beginGesture = (context, input) =>
    editorHelpers().pointer.beginGesture(context, input);

export const movePointer: typeof PointerEdits.movePointer = (context, input) =>
    editorHelpers().pointer.movePointer(context, input);

export const leaveSurface: typeof PointerEdits.leaveSurface = (context) =>
    editorHelpers().pointer.leaveSurface(context);

export const endGesture: typeof PointerEdits.endGesture = (context, input) =>
    editorHelpers().pointer.endGesture(context, input);

export const cancelGesture: typeof PointerEdits.cancelGesture = (context, input) => {
    if (!editorLoaded()) {
        return null;
    }

    return editorHelpers().pointer.cancelGesture(context, input);
};

export const beginPinch: typeof PointerEdits.beginPinch = (context, input) =>
    editorHelpers().pointer.beginPinch(context, input);

export const updatePinch: typeof PointerEdits.updatePinch = (context, input) =>
    editorHelpers().pointer.updatePinch(context, input);

export const endPinch: typeof PointerEdits.endPinch = (context, input) =>
    editorHelpers().pointer.endPinch(context, input);
