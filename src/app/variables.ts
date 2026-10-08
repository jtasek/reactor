import { json } from 'overmind';
import type { Document, Shape, Variable, VariableType } from './types';
import { isHexColor } from './utils';
import { SHAPE_PROPERTIES, applyProperty, type ShapeProperty } from './properties';

const VARIABLE_TYPES: VariableType[] = ['color', 'number', 'text', 'boolean'];

export const isVariableType = (type: string): type is VariableType =>
    VARIABLE_TYPES.some((variableType) => variableType === type);

/** Characters a template marks variables with, so names never hold them. */
const TEMPLATE_CHARACTERS = /[{}$]/;

/** Whether `name` may name a variable: trimmed, not blank, and without `{`, `}` or `$`. */
export const isVariableName = (name: string): boolean =>
    name.trim() === name && name !== '' && !TEMPLATE_CHARACTERS.test(name);

/**
 * A variable, or none when `name` may not name one or `value` is not of `type`: a
 * color `#rrggbb`, a finite number, any text or a boolean.
 */
export function buildVariable(
    id: string,
    name: string,
    type: VariableType,
    value: unknown
): Variable | undefined {
    if (!isVariableName(name)) {
        return undefined;
    }

    switch (type) {
        case 'color':
            return typeof value === 'string' && isHexColor(value)
                ? { id, name, type, values: { default: value } }
                : undefined;
        case 'number':
            return typeof value === 'number' && Number.isFinite(value)
                ? { id, name, type, values: { default: value } }
                : undefined;
        case 'text':
            return typeof value === 'string'
                ? { id, name, type, values: { default: value } }
                : undefined;
        case 'boolean':
            return typeof value === 'boolean'
                ? { id, name, type, values: { default: value } }
                : undefined;
    }
}

/** The variable named `name`; of several, as merges can leave, the one with the lowest id. */
export function variableNamed(
    variables: Record<string, Variable>,
    name: string
): Variable | undefined {
    return Object.values(variables)
        .filter((variable) => variable.name === name)
        .sort((a, b) => (a.id < b.id ? -1 : 1))[0];
}

/** The property that may use a variable under `key`: one the inspector can change. */
export const bindableProperty = (key: string): ShapeProperty | undefined =>
    SHAPE_PROPERTIES.find((property) => property.key === key && property.write);

/** Whether `property` of `shape` may use `variable`: it applies to the shape and has its kind. */
export const canBind = (
    property: ShapeProperty,
    shape: Shape,
    document: Document,
    variable: Variable
): boolean => property.kind === variable.type && property.read(shape, document) !== undefined;

/** Whether writing `variable`'s value to `property` would leave `shape` as it is. */
export function bindingHolds(property: ShapeProperty, shape: Shape, variable: Variable): boolean {
    const own = json(shape);
    const written = structuredClone(own);

    applyProperty(property, written, variable.values.default);

    return JSON.stringify(written) === JSON.stringify(own);
}

/**
 * The variable `shape`'s `key` property follows: bound to it, and showing its value.
 * None when the variable is missing, as another copy may delete it.
 */
export function boundVariable(shape: Shape, key: string, document: Document): Variable | undefined {
    const variableId = shape.bindings?.[key];
    const variable = variableId === undefined ? undefined : document.variables[variableId];
    const property = bindableProperty(key);

    return variable && property && bindingHolds(property, shape, variable) ? variable : undefined;
}

/** Removes `shape`'s binding of `key`, and its bindings once none is left. */
export function unbind(shape: Shape, key: string) {
    if (!shape.bindings || !Object.hasOwn(shape.bindings, key)) {
        return;
    }

    delete shape.bindings[key];

    if (Object.keys(shape.bindings).length === 0) {
        delete shape.bindings;
    }
}

/** The shapes with a property bound to `variableId`, with the keys bound. */
export function shapesBoundTo(document: Document, variableId: string) {
    return Object.values(document.shapes).flatMap((shape) => {
        const keys = Object.entries(shape.bindings ?? {})
            .filter(([, bound]) => bound === variableId)
            .map(([key]) => key);

        return keys.length > 0 ? [{ shape, keys }] : [];
    });
}
