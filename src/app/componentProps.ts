import type {
    Component,
    Document,
    InstanceShape,
    PropertyValue,
    Shape,
    VariableContext
} from './types';
import { SHAPE_PROPERTIES, applyProperty, type ShapeProperty } from './properties';
import { escapeTemplate, templateWithNames, writeText } from './variables';
import { variableContext } from './variableModes';
import { resolveVariable } from './variableResolver';
import { isHexColor } from './utils';

const SOURCE_ONLY = new Set(['name', 'x', 'y', 'width', 'height', 'rotation', 'locked']);

const isExposable = (property: ShapeProperty, shape: Shape, document: Document) =>
    !SOURCE_ONLY.has(property.key) &&
    Boolean(property.write) &&
    property.read(shape, document) !== undefined;

export const exposableProperties = (shape: Shape, document: Document) =>
    SHAPE_PROPERTIES.filter((property) => isExposable(property, shape, document));

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

/** A saved value only applies while the source still exposes a compatible field. */
export function componentOverrideValue(
    instance: InstanceShape,
    component: Component,
    propId: string,
    document: Document,
    theme: VariableContext = {}
): PropertyValue | undefined {
    const resolved = resolveComponentProp(component, propId, document);
    const override = instance.overrides[propId];
    if (
        !resolved ||
        override === undefined ||
        !component.shapesIds.includes(resolved.prop.shapeId) ||
        !isExposable(resolved.property, resolved.source, document)
    ) {
        return undefined;
    }
    const { property } = resolved;
    if (typeof override !== 'object') {
        return acceptsComponentValue(property, override) ? override : undefined;
    }
    const variable = document.variables[override.variableId];
    if (!variable || variable.type !== property.kind) {
        return undefined;
    }
    const value = resolveVariable(variable, document.variables, variableContext(document, theme));

    return acceptsComponentValue(property, value) ? value : undefined;
}

export function componentPropValue(
    instance: InstanceShape,
    component: Component,
    propId: string,
    document: Document,
    theme: VariableContext = {}
): PropertyValue | undefined {
    const resolved = resolveComponentProp(component, propId, document);
    if (!resolved) {
        return undefined;
    }
    const value = componentOverrideValue(instance, component, propId, document, theme);
    if (value === undefined) {
        return resolved.property.read(resolved.source, document);
    }
    if (
        resolved.property.key === 'text' &&
        typeof instance.overrides[propId] === 'string' &&
        typeof value === 'string'
    ) {
        return templateWithNames(value, document.variables);
    }

    return value;
}

/** Applies only the props exposed by this source to one drawn copy. */
export function applyInstanceOverrides(
    source: Shape,
    instance: InstanceShape,
    component: Component,
    document: Document,
    theme: VariableContext = {}
): Shape {
    const props = component.props?.filter((prop) => prop.shapeId === source.id) ?? [];

    if (props.length === 0) {
        return source;
    }

    const copy = { ...source };

    for (const prop of props) {
        const override = instance.overrides[prop.id];

        const value = componentOverrideValue(instance, component, prop.id, document, theme);
        const property = SHAPE_PROPERTIES.find((item) => item.key === prop.key);

        if (value === undefined || !property) {
            continue;
        }
        if (copy.type === 'text' && prop.key === 'text' && typeof value === 'string') {
            // A variable's value is already rendered; literal overrides may be templates.
            const text = typeof override === 'string' ? override : escapeTemplate(value);
            writeText(copy, text, document.variables, variableContext(document, theme));

            continue;
        }
        applyProperty(property, copy, value);
    }

    return copy;
}
