import type { Document } from './types';
import { untracked } from './untracked';

/**
 * Removes shapes from their document with what refers to them: their places in
 * groups, layers and components, the props they back, their links, and their
 * children's parents. One pass over the document however many shapes go, and
 * only what holds a removed shape is written, so each write is a real change.
 */
export function deleteShapes(currentDocument: Document, shapeIds: readonly string[]) {
    if (shapeIds.length === 0) {
        return;
    }

    const removed = new Set(shapeIds);
    // Read without tracking; every write below goes through the store.
    const plain = untracked(currentDocument);

    if (plain.shapesIds.some((id) => removed.has(id))) {
        currentDocument.shapesIds = plain.shapesIds.filter((id) => !removed.has(id));
    }

    for (const id of removed) {
        if (Object.hasOwn(plain.shapes, id)) {
            delete currentDocument.shapes[id];
        }
    }

    if (plain.shapeSelection.some((id) => removed.has(id))) {
        currentDocument.shapeSelection = plain.shapeSelection.filter((id) => !removed.has(id));
    }

    for (const table of ['groups', 'layers', 'components'] as const) {
        for (const member of Object.values(plain[table])) {
            if (member.shapesIds.some((id) => removed.has(id))) {
                currentDocument[table][member.id].shapesIds = member.shapesIds.filter(
                    (id) => !removed.has(id)
                );
            }
        }
    }

    for (const component of Object.values(plain.components)) {
        const removedProps = component.props?.filter((prop) => removed.has(prop.shapeId)) ?? [];

        if (removedProps.length === 0) {
            continue;
        }
        currentDocument.components[component.id].props = component.props?.filter(
            (prop) => !removed.has(prop.shapeId)
        );
        for (const shape of Object.values(plain.shapes)) {
            if (shape.type !== 'instance' || shape.componentId !== component.id) {
                continue;
            }
            const instance = currentDocument.shapes[shape.id];

            if (instance.type !== 'instance') {
                continue;
            }
            removedProps.forEach((prop) => {
                if (Object.hasOwn(shape.overrides, prop.id)) {
                    delete instance.overrides[prop.id];
                }
            });
        }
    }

    for (const link of Object.values(plain.links)) {
        if (
            (link.source !== undefined && removed.has(link.source)) ||
            (link.target !== undefined && removed.has(link.target))
        ) {
            delete currentDocument.links[link.id];
        }
    }

    for (const shape of Object.values(plain.shapes)) {
        if (shape.parentShapeId !== undefined && removed.has(shape.parentShapeId)) {
            delete currentDocument.shapes[shape.id].parentShapeId;
        }

        if (shape.children?.some((child) => removed.has(child.id))) {
            currentDocument.shapes[shape.id].children = shape.children.filter(
                (child) => !removed.has(child.id)
            );
        }
    }
}

/** Removes one shape: see `deleteShapes`. */
export function deleteShape(currentDocument: Document, shapeId: string) {
    deleteShapes(currentDocument, [shapeId]);
}
