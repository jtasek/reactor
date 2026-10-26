import type { Context } from './index';
import type { Box, Document } from './types';
import { frameLayout, renderedShape } from './frameLayout';
import { hitTestShape, hitTolerance } from './geometry';
import { drawnBox, drawnExtent } from './membership';
import { componentScreenView, pointerDocument } from './screenViewEditing';
import { screenOwners } from './screenViews';
import { placeSelectionMenu } from './selectionMenu';
import { isShapeVisible } from './utils';
import { untracked } from './untracked';

type State = Context['state'];

export interface SelectionOverlay {
    document: Document;
    extent: Box;
    viewId: string | null;
}

/** Geometry for one selection in its editing context; never fall back to hidden source artwork. */
export function selectionOverlay(state: State): SelectionOverlay | null {
    const document = state.currentDocument;
    const ids = document.selectedShapesIds;

    if (ids.length === 0) {
        return null;
    }

    const owners = screenOwners(document.frames);
    const inScreen =
        (!document.editingComponentId || componentScreenView(state)) &&
        (Boolean(document.components[document.editingComponentId ?? '']?.sourceOnly) ||
            ids.some((id) => owners.get(document.shapes[id]?.parentFrameId ?? '')));

    if (!inScreen) {
        return document.selectionExtent
            ? { document, extent: document.selectionExtent, viewId: null }
            : null;
    }

    const address = state.events.pointer.screenView;

    if (!address || address.documentId !== document.id) {
        return null;
    }

    const placed = pointerDocument(state);

    if (!ids.every((id) => placed.shapes[id])) {
        return null;
    }

    const extent = drawnExtent(placed, ids);

    return extent
        ? { document: { ...placed, selectionExtent: extent }, extent, viewId: address.viewId }
        : null;
}

export function selectionMenuPlacement(
    state: State,
    alreadyShown: boolean,
    overlay = selectionOverlay(state)
) {
    if (state.events.pointer.dragging) {
        return null;
    }

    return overlay
        ? placeSelectionMenu(
              overlay.extent,
              overlay.document.camera,
              state.events.pointer,
              alreadyShown
          )
        : null;
}

/** Alt measures compare artwork within the selected view, including rotated bounds. */
export function measuredBoxes(state: State, overlay = selectionOverlay(state)) {
    const { keyboard, pointer } = state.events;

    if (!keyboard.altKey || !pointer.inside || pointer.gesture.kind !== 'idle') {
        return null;
    }

    if (!overlay || pointer.hoveredScreenViewId !== overlay.viewId) {
        return null;
    }

    const { document, extent: selection, viewId } = overlay;
    const plain = untracked(document);
    const layout = frameLayout(document);
    const owners = viewId ? null : screenOwners(document.frames);
    const tolerance = hitTolerance(document.camera.scale);
    const target = [...document.shapesIds]
        .reverse()
        .filter((id) => !owners?.get(plain.shapes[id]?.parentFrameId ?? ''))
        .map((id) => plain.shapes[id] && renderedShape(plain, id, layout))
        .find(
            (shape) =>
                shape &&
                !shape.selected &&
                hitTestShape(shape, pointer.current, tolerance) &&
                isShapeVisible(document, shape.id)
        );

    return target ? { selection, target: drawnBox(target) } : null;
}

/** Snap targets and the resized box must share the pressed view's coordinate system. */
export function snappedBox(state: State) {
    const { gesture } = state.events.pointer;

    if (
        (gesture.kind === 'resizing' ||
            gesture.kind === 'resizingGroup' ||
            gesture.kind === 'resizingComponent') &&
        (gesture.snapLines.x !== null || gesture.snapLines.y !== null)
    ) {
        const document = pointerDocument(state);
        const ids = gesture.kind === 'resizing' ? [gesture.shapeId] : Object.keys(gesture.shapes);

        return drawnExtent(
            document,
            ids.filter((id) => document.shapes[id] && isShapeVisible(document, id))
        );
    }

    if (
        gesture.kind !== 'moving' ||
        !gesture.dragged ||
        !gesture.box ||
        (gesture.snapLines.x === null && gesture.snapLines.y === null)
    ) {
        return null;
    }

    const { topLeft, width, height } = gesture.box;
    const left = topLeft.x + gesture.movedBy.x;
    const top = topLeft.y + gesture.movedBy.y;

    return {
        topLeft: { x: left, y: top },
        bottomRight: { x: left + width, y: top + height },
        width,
        height
    };
}
