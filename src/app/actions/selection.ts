import { Action, Application, Document } from '../types';
import { editableSelectedShapesIds, selectedItems } from '../membership';

const unselect = ({ shapes }: Document, shapeIds: string[]) => {
    shapeIds.forEach((id) => {
        if (shapes[id]?.selected) {
            shapes[id].selected = false;
        }
    });
};

export const bringSelectionToFront: Action = ({ state, actions }) => {
    actions.bringShapesToFront(editableSelectedShapesIds(state.currentDocument));
};

export const sendSelectionToBack: Action = ({ state, actions }) => {
    actions.sendShapesToBack(editableSelectedShapesIds(state.currentDocument));
};

/** Hides the selection, a group selected as one as a group; what is hidden is no longer selected. */
export const hideSelection: Action = ({ state }) => {
    const { currentDocument } = state;
    const { groups, shapes } = selectedItems(currentDocument);

    groups.forEach((group) => {
        group.visible = false;
        unselect(currentDocument, group.shapesIds);
    });
    shapes.forEach((shape) => {
        shape.visible = false;
        shape.selected = false;
    });
};

/** Shows every hidden shape, group and layer. */
export const showAll: Action = ({ state }) => {
    const { shapes, groups, layers } = state.currentDocument;

    [shapes, groups, layers].forEach((table) =>
        Object.values(table).forEach((item) => {
            if (!item.visible) {
                item.visible = true;
            }
        })
    );
};

const setSelectionLocked = ({ currentDocument }: Application, locked: boolean) => {
    const { groups, shapes } = selectedItems(currentDocument);

    [...groups, ...shapes].forEach((item) => {
        if (item.locked !== locked) {
            item.locked = locked;
        }
    });
};

/** Locks the selection, a group selected as one as a group; it stays selected. */
export const lockSelection: Action = ({ state }) => {
    setSelectionLocked(state, true);
};

export const unlockSelection: Action = ({ state }) => {
    setSelectionLocked(state, false);
};
