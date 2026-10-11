import type { Application, Component, Document, Point } from './types';
import { boxCenter, isShapeVisible, rotatePoint } from './utils';
import { withTheirGroups } from './membership';

/** Local sources are selectable containers; imported sources have no canvas members. */
export const localComponents = (document: Document) =>
    Object.values(document.components).filter((component) => !component.library);

export const shapeComponent = (document: Document, shapeId: string) =>
    localComponents(document).find((component) => component.shapesIds.includes(shapeId));

/** A definition selected in its focused editor can be copied as an instance. */
export function focusedSourceOnlyId(state: Application): string | null {
    const selected = state.selectedComponent;

    if (
        !selected ||
        selected.documentId !== state.currentDocumentId ||
        selected.shapeId ||
        state.enteredComponentId !== selected.componentId ||
        !state.currentDocument.components[selected.componentId]?.sourceOnly
    ) {
        return null;
    }

    return selected.componentId;
}

export const shownComponentShapesIds = (document: Document, component: Component) =>
    component.shapesIds.filter((id) => isShapeVisible(document, id));

export function selectedComponentsIdsOf(document: Document, enteredComponentId: string | null) {
    return localComponents(document)
        .filter((component) => {
            const shown = shownComponentShapesIds(document, component);

            return (
                component.id !== enteredComponentId &&
                shown.length > 0 &&
                shown.every((id) => document.shapes[id].selected)
            );
        })
        .map((component) => component.id);
}

/** A component owns its members before a group does, until the component is entered. */
export function selectionMembers(
    document: Document,
    shapeIds: string[],
    enteredGroupId: string | null,
    enteredComponentId: string | null
) {
    const selected = new Set(shapeIds);
    const components = localComponents(document);
    const componentMembers = new Set(components.flatMap((component) => component.shapesIds));

    for (const component of components) {
        if (
            component.id === enteredComponentId ||
            !component.shapesIds.some((id) => selected.has(id))
        ) {
            continue;
        }
        component.shapesIds.forEach((id) => selected.add(id));
    }
    const grouped = withTheirGroups(
        document,
        shapeIds.filter((id) => !componentMembers.has(id)),
        enteredGroupId
    );
    grouped.forEach((id) => selected.add(id));

    return selected;
}

/** Includes the empty space inside a source's rotated bounding box. */
export function componentAtPoint(
    document: Document,
    point: Point,
    enteredComponentId: string | null
) {
    return localComponents(document).findLast((component) => {
        const frame =
            component.id === enteredComponentId
                ? undefined
                : document.componentFrames[component.id];

        if (!frame) {
            return false;
        }
        const local = rotatePoint(point, boxCenter(frame.box), -frame.rotation);
        const { topLeft, bottomRight } = frame.box;

        return (
            local.x >= topLeft.x &&
            local.x <= bottomRight.x &&
            local.y >= topLeft.y &&
            local.y <= bottomRight.y
        );
    });
}

export function hoveredComponentsIds(
    document: Document,
    enteredComponentId: string | null,
    pointer: { current: Point; dragging: boolean; inside: boolean }
) {
    if (!pointer.inside || pointer.dragging) {
        return [];
    }
    const component = componentAtPoint(document, pointer.current, enteredComponentId);

    if (!component || document.selectedComponentsIds.includes(component.id)) {
        return [];
    }
    const covered = document.shapesIds.some(
        (id) => document.shapes[id].active && !component.shapesIds.includes(id)
    );

    return covered ? [] : [component.id];
}
