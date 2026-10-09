import type { Document, Shape } from './types';
import { invalidOverrideIds } from './componentProps';

/** Makes merged component membership safe and deterministic on every copy. */
export function repairComponents(document: Document): void {
    const components = document.components;
    const componentIds = Object.keys(components).sort();
    const owned = new Set<string>();

    for (const componentId of componentIds) {
        const component = components[componentId];
        const members = component.shapesIds.filter((id) => {
            const shape = component.sourceShapes?.[id] ?? document.shapes[id];

            if (!shape || (!component.library && owned.has(id))) {
                return false;
            }
            if (!component.library) {
                owned.add(id);
            }

            return true;
        });
        if (members.length !== component.shapesIds.length) {
            component.shapesIds = members;
        }
    }

    const visited = new Set<string>();
    const visiting = new Set<string>();
    const member = (componentId: string, id: string): Shape | undefined =>
        components[componentId].sourceShapes?.[id] ?? document.shapes[id];
    const visit = (componentId: string) => {
        if (visited.has(componentId)) {
            return;
        }
        visiting.add(componentId);
        const component = components[componentId];
        const members = component.shapesIds.filter((id) => {
            const shape = member(componentId, id);

            if (shape?.type !== 'instance') {
                return true;
            }
            if (!components[shape.componentId] || visiting.has(shape.componentId)) {
                return false;
            }
            visit(shape.componentId);

            return components[shape.componentId].shapesIds.length > 0;
        });
        if (members.length !== component.shapesIds.length) {
            component.shapesIds = members;
        }
        visiting.delete(componentId);
        visited.add(componentId);
    };

    componentIds.forEach(visit);

    for (const component of Object.values(components)) {
        const props = component.props?.filter((prop) => component.shapesIds.includes(prop.shapeId));
        if (props?.length !== component.props?.length) {
            component.props = props;
        }
    }
    for (const shape of Object.values(document.shapes)) {
        if (shape.type !== 'instance') {
            continue;
        }
        if (!components[shape.componentId]) {
            continue;
        }
        invalidOverrideIds(shape, components[shape.componentId]).forEach((id) => {
            delete shape.overrides[id];
        });
    }
}
