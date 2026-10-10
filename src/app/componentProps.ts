import type { Component, Document, InstanceShape, PropertyValue, Shape } from './types';
import { SHAPE_PROPERTIES, applyProperty, type ShapeProperty } from './properties';
import { escapeTemplate, templateWithNames, variableValue, writeText } from './variables';
import { isHexColor } from './utils';

const SOURCE_ONLY = new Set(['name', 'x', 'y', 'width', 'height', 'rotation', 'locked']);

export const exposableProperties = (shape: Shape, document: Document) =>
    SHAPE_PROPERTIES.filter(
        (property) =>
            !SOURCE_ONLY.has(property.key) &&
            property.write &&
            property.read(shape, document) !== undefined
    );

export function resolveComponentProp(
    component: Component | undefined,
    propId: string,
    document: Document
) {
    const prop = component?.props?.find((item) => item.id === propId);

    if (!component || !prop) {
        return undefined;
    }
    const source = component.sourceShapes?.[prop.shapeId] ?? document.shapes[prop.shapeId];
    const property = SHAPE_PROPERTIES.find((item) => item.key === prop.key);

    if (!source || !property) {
        return undefined;
    }

    return { prop, source, property };
}

export function acceptsComponentValue(property: ShapeProperty, value: PropertyValue): boolean {
    switch (property.kind) {
        case 'number':
            return (
                typeof value === 'number' &&
                Number.isFinite(value) &&
                (property.accepts?.(value) ?? true)
            );
        case 'text':
            return typeof value === 'string' && (property.accepts?.(value) ?? true);
        case 'boolean':
            return typeof value === 'boolean';
        case 'color':
            return typeof value === 'string' && (value === '' || isHexColor(value));
    }
}

export function invalidOverrideIds(instance: InstanceShape, component: Component): string[] {
    const valid = new Set(component.props?.map((prop) => prop.id) ?? []);

    return Object.keys(instance.overrides).filter((id) => !valid.has(id));
}

export function componentPropValue(
    instance: InstanceShape,
    component: Component,
    propId: string,
    document: Document
): PropertyValue | undefined {
    const resolved = resolveComponentProp(component, propId, document);

    if (!resolved) {
        return undefined;
    }
    const { source, property } = resolved;
    const override = instance.overrides[propId];

    if (typeof override === 'object') {
        const variable = document.variables[override.variableId];

        return variable
            ? variableValue(variable, document.variables)
            : property.read(source, document);
    }

    if (property.key === 'text' && typeof override === 'string') {
        return templateWithNames(override, document.variables);
    }

    return override ?? property.read(source, document);
}

/** Applies only the props exposed by this source to one drawn copy. */
export function applyInstanceOverrides(
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
        const override = instance.overrides[prop.id];

        if (override === undefined) {
            continue;
        }
        if (typeof override === 'object' && !document.variables[override.variableId]) {
            continue;
        }
        const value = componentPropValue(instance, component, prop.id, document);
        const property = SHAPE_PROPERTIES.find((item) => item.key === prop.key);

        if (value === undefined || !property) {
            continue;
        }
        if (copy.type === 'text' && prop.key === 'text' && typeof value === 'string') {
            // A variable's value is already rendered; literal overrides may be templates.
            const text = typeof override === 'string' ? override : escapeTemplate(value);
            writeText(copy, text, document.variables);

            continue;
        }
        applyProperty(property, copy, value);
    }

    return copy;
}
