import { unbindMovedProperties } from '../variables';
import { Action, ActionWithParam, Application, Document, Orientation, Point } from '../types';
import type { AlignTo, Spacing } from '../alignment';
import { editorHelpers } from '../editorHelpers';
import { translateShape } from '../geometry';
import { getCommand } from './startup';
import { drawnExtent, selectedItems, shapeGroup } from '../membership';
import { isShapeVisible } from '../utils';
import { unbind } from '../variables';

/** Aligning, which the editor provides as it loads. */
const alignment = () => editorHelpers().alignment;

const unselect = ({ shapes }: Document, shapeIds: string[]) => {
    shapeIds.forEach((id) => {
        if (shapes[id]?.selected) {
            shapes[id].selected = false;
        }
    });
};

export const bringSelectionToFront: Action = ({ state, actions }) => {
    actions.bringShapesToFront(state.currentDocument.editableSelectedShapesIds);
};

export const sendSelectionToBack: Action = ({ state, actions }) => {
    actions.sendShapesToBack(state.currentDocument.editableSelectedShapesIds);
};

export const hideSelection: Action = ({ state }) => {
    const { currentDocument } = state;
    const { groups, shapes } = selectedItems(currentDocument);

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
    const { shapes, groups, layers } = state.currentDocument;

    actions.showAllLayers();

    Object.values(shapes).forEach((shape) => {
        if (!shape.visible) {
            unbind(shape, 'visible');
        }
    });
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
        guides: Object.values(state.currentDocument.guides).filter((guide) => guide.selected),
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

    actions.unselectGuides();
    select(chosen);
    // One shape of a group is selected alone, as inside its group.
    state.enteredGroupId =
        shapeIds.length === 1 ? (shapeGroup(state.currentDocument, shapeIds[0])?.id ?? null) : null;

    if (!actions.runCommand(command)) {
        select(new Set(before.selected));
        before.guides.forEach((guide) => {
            guide.selected = true;
        });
        state.enteredGroupId = before.enteredGroupId;
    }
};

/** The movable selected items, each with the box its shown shapes are drawn in. */
const placedItems = (document: Document) =>
    document.movableSelectedItems.flatMap((shapeIds) => {
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
                unbindMovedProperties(shape, offset);
                translateShape(shape, offset);
            }
        });
    });

/** Lines the selected items up on a side or a center of their box. */
export const alignSelection: ActionWithParam<AlignTo> = ({ state }, to) => {
    const { currentDocument } = state;
    const items = placedItems(currentDocument);

    if (items.length >= alignment().ALIGN_MINIMUM) {
        moveItems(
            currentDocument,
            items,
            alignment().alignOffsets(
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

    if (items.length >= alignment().SPACE_MINIMUM) {
        moveItems(
            currentDocument,
            items,
            alignment().spaceOffsets(
                items.map(({ box }) => box),
                axis,
                spacing
            )
        );
    }
};
