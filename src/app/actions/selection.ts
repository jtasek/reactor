import { Action, ActionWithParam, Application, Document, Orientation, Point } from '../types';
import {
    ALIGN_MINIMUM,
    AlignTo,
    SPACE_MINIMUM,
    Spacing,
    alignOffsets,
    spaceOffsets
} from '../alignment';
import { translateShape } from '../geometry';
import { getCommand } from './startup';
import {
    drawnExtent,
    editableSelectedShapesIds,
    movableSelectedItems,
    selectedItems,
    shapeGroup
} from '../membership';
import { isShapeVisible } from '../utils';

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

/** The movable selected items, each with the box its shown shapes are drawn in. */
const placedItems = (document: Document) =>
    movableSelectedItems(document).flatMap((shapeIds) => {
        const box = drawnExtent(
            document,
            shapeIds.filter((id) => isShapeVisible(document, id))
        );

        return box ? [{ shapeIds, box }] : [];
    });

const moveItems = (document: Document, items: { shapeIds: string[] }[], offsets: Point[]) =>
    items.forEach(({ shapeIds }, index) => {
        const offset = offsets[index];

        if (offset.x === 0 && offset.y === 0) {
            return;
        }

        shapeIds.forEach((id) => {
            const shape = document.shapes[id];

            if (shape) {
                translateShape(shape, offset);
            }
        });
    });

/** Lines the selected items up on a side or a center of their box. */
export const alignSelection: ActionWithParam<AlignTo> = ({ state }, to) => {
    const { currentDocument } = state;
    const items = placedItems(currentDocument);

    if (items.length >= ALIGN_MINIMUM) {
        moveItems(
            currentDocument,
            items,
            alignOffsets(
                items.map(({ box }) => box),
                to
            )
        );
    }
};

/** Spaces the selected items out along an axis, the outermost staying. */
export const spaceSelection: ActionWithParam<{ axis: Orientation; spacing: Spacing }> = (
    { state },
    { axis, spacing }
) => {
    const { currentDocument } = state;
    const items = placedItems(currentDocument);

    if (items.length >= SPACE_MINIMUM) {
        moveItems(
            currentDocument,
            items,
            spaceOffsets(
                items.map(({ box }) => box),
                axis,
                spacing
            )
        );
    }
};
