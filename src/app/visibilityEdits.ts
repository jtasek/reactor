import type { Action, Application, Document } from './types';
import { selectedItems } from './membership';
import { lockedFrameForShapes } from './frameState';
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

export const showAll: Action = ({ state, actions }) => {
    const { shapes, groups, layers, frames } = state.currentDocument;

    actions.showAllLayers();

    Object.values(shapes).forEach((shape) => {
        if (!shape.visible) {
            unbind(shape, 'visible');
        }
    });
    [shapes, groups, layers, frames].forEach((table) =>
        Object.values(table).forEach((item) => {
            if (!item.visible) {
                item.visible = true;
            }
        })
    );
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
