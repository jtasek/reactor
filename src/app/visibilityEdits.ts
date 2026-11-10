import { setShapesSelected } from './shapeSelection';
import type { Action, Application, Document, Group, Shape } from './types';
import { selectedItems } from './membership';
import { frameState, lockedFrameForShapes } from './frameState';
import { unbind } from './variables';

/** Flag commands must not change descendants of locked frames. */
export function flagEditableItems(document: Document) {
    const { groups, shapes } = selectedItems(document);

    return {
        groups: groups.filter((group) => !lockedFrameForShapes(document, group.shapesIds)),
        shapes: shapes.filter((shape) => !lockedFrameForShapes(document, [shape.id]))
    };
}

/**
 * Whether a selected item flag commands may change passes `test`, as
 * `flagEditableItems` lists them. It stops at the first one, and runs `test` before
 * the frame check, so with thousands selected a guard reads little.
 */
export function someFlagEditableItem(
    document: Document,
    test: (item: Group | Shape) => boolean = () => true
) {
    const groups = document.selectedGroupsIds.map((id) => document.groups[id]);
    const grouped = new Set(groups.flatMap((group) => group.shapesIds));

    return (
        groups.some((group) => test(group) && !lockedFrameForShapes(document, group.shapesIds)) ||
        document.selectedShapesIds.some(
            (id) =>
                !grouped.has(id) &&
                test(document.shapes[id]) &&
                !lockedFrameForShapes(document, [id])
        )
    );
}

const unselect = (document: Document, shapeIds: string[]) =>
    setShapesSelected(document, shapeIds, false);

export const hideSelection: Action = ({ state }) => {
    const { currentDocument } = state;
    const { groups, shapes } = flagEditableItems(currentDocument);

    groups.forEach((group) => {
        group.visible = false;
        unselect(currentDocument, group.shapesIds);
    });
    shapes.forEach((shape) => {
        unbind(shape, 'visible');
        shape.visible = false;
    });
    unselect(
        currentDocument,
        shapes.map((shape) => shape.id)
    );
};

/** Show all leaves what a locked frame holds as it is; a frame's own lock does not stop it. */
export const showAll: Action = ({ state, actions }) => {
    const document = state.currentDocument;
    const { shapes, groups, layers, frames } = document;
    const hiddenShapes = Object.values(shapes).filter(
        (shape) => !shape.visible && !lockedFrameForShapes(document, [shape.id])
    );
    const hiddenGroups = Object.values(groups).filter(
        (group) => !group.visible && !lockedFrameForShapes(document, group.shapesIds)
    );
    const hiddenFrames = Object.values(frames).filter((frame) => {
        const lockedBy = frameState(document, frame.id)?.lockedBy;

        return !frame.visible && (lockedBy === undefined || lockedBy === frame.id);
    });
    const hiddenLayers = Object.values(layers).filter((layer) => !layer.visible);

    actions.showAllLayers();

    hiddenShapes.forEach((shape) => unbind(shape, 'visible'));
    [...hiddenShapes, ...hiddenGroups, ...hiddenFrames, ...hiddenLayers].forEach((item) => {
        item.visible = true;
    });
};

const setSelectionLocked = ({ currentDocument }: Application, locked: boolean) => {
    const { groups, shapes } = flagEditableItems(currentDocument);

    shapes.forEach((shape) => unbind(shape, 'locked'));
    [...groups, ...shapes].forEach((item) => {
        if (item.locked !== locked) {
            item.locked = locked;
        }
    });
};

export const lockSelection: Action = ({ state }) => {
    setSelectionLocked(state, true);
};

export const unlockSelection: Action = ({ state }) => {
    setSelectionLocked(state, false);
};
