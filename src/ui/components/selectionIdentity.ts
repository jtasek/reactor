import { drawnExtent, shownShapesIds } from 'src/app/membership';
import type { Box, Document } from 'src/app/types';
import type { ObjectType } from './ObjectTypeSymbol';

export interface SelectionIdentity {
    type: ObjectType;
    name: string;
    extent: Box | null;
}

/** The object represented by one selection, including container selections. */
export function selectionIdentity(document: Document): SelectionIdentity | null {
    const componentId = document.selectedComponentsIds[0];

    if (
        document.selectedComponentsIds.length === 1 &&
        document.components[componentId] &&
        document.selectedShapesIds.every((id) =>
            document.components[componentId].shapesIds.includes(id)
        )
    ) {
        return {
            type: 'component',
            name: document.components[componentId].name,
            extent: document.selectionExtent
        };
    }

    const groupId = document.selectedGroupsIds[0];

    if (
        document.selectedGroupsIds.length === 1 &&
        document.groups[groupId] &&
        document.selectedShapesIds.every((id) => document.groups[groupId].shapesIds.includes(id))
    ) {
        return {
            type: 'group',
            name: document.groups[groupId].name,
            extent: document.selectionExtent
        };
    }

    const layerId = document.selectedLayersIds[0];

    if (document.selectedLayersIds.length === 1 && document.layers[layerId]) {
        const layer = document.layers[layerId];
        const shown = shownShapesIds(document, document.editingComponentId);

        return {
            type: 'layer',
            name: layer.name,
            extent: drawnExtent(
                document,
                layer.shapesIds.filter((id) => shown.has(id))
            )
        };
    }

    if (document.surfaceSelected) {
        const shown = shownShapesIds(document, document.editingComponentId);
        const onLayers = new Set(
            Object.values(document.layers).flatMap((layer) => layer.shapesIds)
        );

        return {
            type: 'surface',
            name: 'Canvas',
            extent: drawnExtent(
                document,
                document.shapesIds.filter((id) => shown.has(id) && !onLayers.has(id))
            )
        };
    }

    const shapeId = document.selectedShapesIds[0];

    if (document.selectedShapesIds.length !== 1 || !document.shapes[shapeId]) {
        return null;
    }

    const shape = document.shapes[shapeId];

    return { type: shape.type, name: shape.name, extent: document.selectionExtent };
}
