import type { ActionWithParam, PropertyValue } from './types';
import { exposableProperties, resolveComponentProp, acceptsComponentValue } from './componentProps';
import { isShapeLocked } from './utils';

export const exposeComponentProp: ActionWithParam<{
    componentId: string;
    shapeId: string;
    key: string;
    label: string;
}> = ({ state, effects }, { componentId, shapeId, key, label }) => {
    const component = state.currentDocument.components[componentId];
    const shape = state.currentDocument.shapes[shapeId];

    if (
        !component ||
        component.library ||
        component.locked ||
        state.currentDocument.locked ||
        !component.shapesIds.includes(shapeId) ||
        !shape ||
        !label.trim() ||
        !exposableProperties(shape, state.currentDocument).some((item) => item.key === key) ||
        component.props?.some((item) => item.shapeId === shapeId && item.key === key)
    ) {
        return;
    }
    component.props = [
        ...(component.props ?? []),
        { id: effects.newId(), shapeId, key, label: label.trim() }
    ];
};

export const removeComponentProp: ActionWithParam<{ componentId: string; propId: string }> = (
    { state },
    { componentId, propId }
) => {
    const component = state.currentDocument.components[componentId];

    if (!component || component.library || component.locked || state.currentDocument.locked) {
        return;
    }
    component.props = component.props?.filter((prop) => prop.id !== propId);
    Object.values(state.currentDocument.shapes).forEach((shape) => {
        if (shape.type === 'instance' && shape.componentId === componentId) {
            delete shape.overrides[propId];
        }
    });
};

export const setInstanceOverride: ActionWithParam<{
    instanceIds: string[];
    propId: string;
    value: PropertyValue;
}> = ({ state }, { instanceIds, propId, value }) => {
    if (state.currentDocument.locked) {
        return;
    }
    instanceIds.forEach((id) => {
        const shape = state.currentDocument.shapes[id];

        if (shape?.type !== 'instance' || isShapeLocked(state.currentDocument, id)) {
            return;
        }
        const component = state.currentDocument.components[shape.componentId];
        const resolved = resolveComponentProp(component, propId, state.currentDocument);

        if (!resolved) {
            return;
        }
        const { source, property } = resolved;

        if (!exposableProperties(source, state.currentDocument).includes(property)) {
            return;
        }
        if (!acceptsComponentValue(property, value)) {
            return;
        }
        shape.overrides[propId] = value;
    });
};

export const bindInstanceOverride: ActionWithParam<{
    instanceIds: string[];
    propId: string;
    variableId: string;
}> = ({ state }, { instanceIds, propId, variableId }) => {
    const variable = state.currentDocument.variables[variableId];

    if (!variable || state.currentDocument.locked) {
        return;
    }

    instanceIds.forEach((id) => {
        const shape = state.currentDocument.shapes[id];

        if (shape?.type !== 'instance' || isShapeLocked(state.currentDocument, id)) {
            return;
        }
        const component = state.currentDocument.components[shape.componentId];
        const resolved = resolveComponentProp(component, propId, state.currentDocument);

        if (!resolved) {
            return;
        }
        const { source, property } = resolved;

        if (!exposableProperties(source, state.currentDocument).includes(property)) {
            return;
        }
        if (property.kind !== variable.type) {
            return;
        }
        shape.overrides[propId] = { variableId };
    });
};

export const resetInstanceOverrides: ActionWithParam<{
    instanceIds: string[];
    propId?: string;
}> = ({ state }, { instanceIds, propId }) => {
    if (state.currentDocument.locked) {
        return;
    }
    instanceIds.forEach((id) => {
        const shape = state.currentDocument.shapes[id];

        if (shape?.type !== 'instance' || isShapeLocked(state.currentDocument, id)) {
            return;
        }
        if (propId) {
            delete shape.overrides[propId];

            return;
        }
        shape.overrides = {};
    });
};
