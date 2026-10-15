import type { Document } from './types';

/**
 * Removes a shape from its document with what refers to it: its place in groups,
 * layers and components, the props it backs, its links, and its children's parent.
 */
export function deleteShape(currentDocument: Document, shapeId: string) {
    const index = currentDocument.shapesIds.indexOf(shapeId);

    if (index >= 0) {
        currentDocument.shapesIds.splice(index, 1);
    }

    delete currentDocument.shapes[shapeId];

    for (const table of [
        currentDocument.groups,
        currentDocument.layers,
        currentDocument.components
    ]) {
        for (const member of Object.values(table)) {
            member.shapesIds = member.shapesIds.filter((id) => id !== shapeId);
        }
    }

    for (const component of Object.values(currentDocument.components)) {
        const removedProps = component.props?.filter((prop) => prop.shapeId === shapeId) ?? [];

        if (removedProps.length === 0) {
            continue;
        }
        component.props = component.props?.filter((prop) => prop.shapeId !== shapeId);
        Object.values(currentDocument.shapes).forEach((shape) => {
            if (shape.type !== 'instance' || shape.componentId !== component.id) {
                return;
            }
            removedProps.forEach((prop) => {
                delete shape.overrides[prop.id];
            });
        });
    }

    for (const link of Object.values(currentDocument.links)) {
        if (link.source === shapeId || link.target === shapeId) {
            delete currentDocument.links[link.id];
        }
    }

    for (const shape of Object.values(currentDocument.shapes)) {
        if (shape.parentShapeId === shapeId) {
            delete shape.parentShapeId;
        }

        if (shape.children) {
            shape.children = shape.children.filter((child) => child.id !== shapeId);
        }
    }
}
