import type { Action, Application, Document } from './types';
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

const unselect = ({ shapes }: Document, shapeIds: string[]) => {
    shapeIds.forEach((id) => {
        if (shapes[id]?.selected) {
            shapes[id].selected = false;
        }
    });
};

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
        shape.selected = false;
    });
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
