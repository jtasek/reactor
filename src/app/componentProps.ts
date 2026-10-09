import type { Component, Document, InstanceShape, PropertyValue, Shape } from './types';
import { SHAPE_PROPERTIES, applyProperty } from './properties';
import { variableValue } from './variables';

const SOURCE_ONLY = new Set(['name', 'x', 'y', 'width', 'height', 'rotation', 'locked']);

export const exposableProperties = (shape: Shape, document: Document) =>
    SHAPE_PROPERTIES.filter(
        (property) =>
            !SOURCE_ONLY.has(property.key) &&
            property.write &&
            property.read(shape, document) !== undefined
    );

export function componentPropValue(
    instance: InstanceShape,
    component: Component,
    propId: string,
    document: Document
): PropertyValue | undefined {
    const prop = component.props?.find((item) => item.id === propId);
    const source =
        prop && (component.sourceShapes?.[prop.shapeId] ?? document.shapes[prop.shapeId]);
    const property = prop && SHAPE_PROPERTIES.find((item) => item.key === prop.key);

    if (!source || !property) {
        return undefined;
    }

    const override = instance.overrides[propId];

    if (typeof override === 'object') {
        const variable = document.variables[override.variableId];

        return variable
            ? variableValue(variable, document.variables)
            : property.read(source, document);
    }

    return override ?? property.read(source, document);
}

/** Applies only the props exposed by this source to one drawn copy. */
export function instanceMember(
    source: Shape,
    instance: InstanceShape,
    component: Component,
    document: Document
): Shape {
    const props = component.props?.filter((prop) => prop.shapeId === source.id) ?? [];

    if (props.length === 0) {
        return source;
    }

    const copy = { ...source };

    for (const prop of props) {
        const value = componentPropValue(instance, component, prop.id, document);
        const property = SHAPE_PROPERTIES.find((item) => item.key === prop.key);

        if (value !== undefined && property) {
            applyProperty(property, copy, value);
        }
    }

    return copy;
}
