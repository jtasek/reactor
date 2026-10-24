import type { Document } from './types';
import type { OutlineLayer } from './membership';

/** Scene projections exclude definition-only members, which appear under Components. */
export function sceneLayers(layers: OutlineLayer[], document: Document): OutlineLayer[] {
    const sources = document.sourceOnlyShapesIds;

    return layers.map((layer) => ({
        layerId: layer.layerId,
        groups: layer.groups
            .map((group) => ({
                ...group,
                shapesIds: group.shapesIds.filter((id) => !sources.has(id))
            }))
            .filter((group) => group.shapesIds.length > 0),
        shapesIds: layer.shapesIds.filter((id) => !sources.has(id))
    }));
}

export function selectedComponentContext(
    document: Document,
    selection: { componentId: string; shapeId?: string } | null
):
    | { kind: 'source'; componentId: string }
    | { kind: 'child'; componentId: string; shapeId: string }
    | { kind: 'instance'; componentId: string; shapeId: string }
    | null {
    const selected = document.selectedShapes;
    const selectedSourceId = document.selectedComponentsIds[0];
    const source = selection
        ? document.components[selection.componentId]
        : selectedSourceId && document.components[selectedSourceId];

    if (source) {
        if (
            selection?.shapeId &&
            selected.length === 1 &&
            selected[0].id === selection.shapeId &&
            source.shapesIds.includes(selection.shapeId)
        ) {
            return { kind: 'child', componentId: source.id, shapeId: selection.shapeId };
        }
        if (selected.every((shape) => source.shapesIds.includes(shape.id))) {
            return { kind: 'source', componentId: source.id };
        }
        if (selected.length === 1 && source.shapesIds.includes(selected[0].id)) {
            return { kind: 'child', componentId: source.id, shapeId: selected[0].id };
        }
    }
    if (selected.length !== 1 || selected[0].type !== 'instance') {
        return null;
    }

    return { kind: 'instance', componentId: selected[0].componentId, shapeId: selected[0].id };
}
