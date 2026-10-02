import { Action, ActionWithParam, Application, Document } from '../types';
import { getCommand } from './startup';
import { editableSelectedShapesIds, selectedItems, shapeGroup } from '../membership';

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

/** Shows every hidden shape, group and layer, and every layer again after one was highlighted. */
export const showAll: Action = ({ state, actions }) => {
    const { shapes, groups, layers } = state.currentDocument;

    actions.showAllLayers();

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

/**
 * Runs a command for the given shapes, as an item's menu does: they become the
 * selection, then the command runs. When it may not run for them, the selection
 * stays as it was.
 */
export const runCommandOn: ActionWithParam<{ shapeIds: string[]; commandId: string }> = (
    { state, actions },
    { shapeIds, commandId }
) => {
    const command = getCommand(commandId);

    if (!command) {
        return;
    }

    const { shapes } = state.currentDocument;
    const chosen = new Set(shapeIds);
    const before = {
        selected: Object.values(shapes)
            .filter((shape) => shape.selected)
            .map((shape) => shape.id),
        enteredGroupId: state.enteredGroupId
    };
    const select = (ids: Set<string>) =>
        Object.values(shapes).forEach((shape) => {
            if (shape.selected !== ids.has(shape.id)) {
                shape.selected = ids.has(shape.id);
            }
        });

    select(chosen);
    // One shape of a group is selected alone, as inside its group.
    state.enteredGroupId =
        shapeIds.length === 1 ? (shapeGroup(state.currentDocument, shapeIds[0])?.id ?? null) : null;

    if (!actions.runCommand(command)) {
        select(new Set(before.selected));
        state.enteredGroupId = before.enteredGroupId;
    }
};
