import { json } from 'overmind';
import type { Document, Shape, Text, Variable, VariableType } from './types';
import { isHexColor } from './utils';
import {
    SHAPE_PROPERTIES,
    applyProperty,
    type PropertyValue,
    type ShapeProperty
} from './properties';

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

/** Numbers are compared to a thousandth, so the noise of measuring a shape ends no binding. */
const COMPARED_PRECISION = 1000;

const comparable = (value: unknown) =>
    JSON.stringify(value, (_, item: unknown) =>
        typeof item === 'number' ? Math.round(item * COMPARED_PRECISION) : item
    );

/** Whether `property` takes `value`, rather than leaving the shape as it is. */
export function accepts(property: ShapeProperty, value: PropertyValue): boolean {
    if (property.kind === 'text' && typeof value === 'string') {
        return property.accepts?.(value) ?? true;
    }

    if (property.kind === 'number' && typeof value === 'number') {
        return property.accepts?.(value) ?? true;
    }

    return true;
}

/** Whether writing `value` to `property` would leave `shape` as it is. */
export function bindingHolds(property: ShapeProperty, shape: Shape, value: PropertyValue): boolean {
    const own = json(shape);
    const written = structuredClone(own);

    applyProperty(property, written, value);

    return comparable(written) === comparable(own);
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

/**
 * Writes into the shapes what the document's variables make them now that they
 * changed from `before`: the values of the properties bound to them and the text of
 * texts with a template. A binding or template that no longer held before, as a
 * drag or typing set the property otherwise, is removed, as is a binding to a
 * deleted variable; one whose value the property refused is kept.
 */
export function applyVariableChanges(document: Document, before: Record<string, Variable>) {
    const { variables } = document;

    Object.values(document.shapes).forEach((shape) => {
        Object.entries(shape.bindings ?? {}).forEach(([key, variableId]) => {
            const property = bindableProperty(key);
            const previous = before[variableId];
            const variable = variables[variableId];

            if (!property || !previous) {
                return;
            }

            const value = variableValue(previous, before);

            if (!variable || (accepts(property, value) && !bindingHolds(property, shape, value))) {
                unbind(shape, key);

                return;
            }

            const next = variableValue(variable, variables);

            if (next !== value) {
                applyProperty(property, shape, next);
            }
        });

        if (shape.type !== 'text' || shape.template === undefined) {
            return;
        }

        const previous = renderTemplate(shape.template, before);

        // A blank text, which a text does not take, left the text as it was.
        if (previous.trim() && shape.value !== previous) {
            delete shape.template;

            return;
        }

        const value = renderTemplate(shape.template, variables);

        if (value !== shape.value && value.trim()) {
            shape.value = value;
        }
    });
}

/**
 * `\${`, kept as written, or `${...}`: a variable's name, or its id followed by `$`
 * and the name it had, which shows when no variable has the id.
 */
export const TEMPLATE_PART = /\\\$\{|\$\{([^{}$]*)(?:\$([^{}$]*))?\}/g;

/** How deep text variables may name others in their values, so a long chain still ends. */
export const TEMPLATE_DEPTH = 16;

/** The variable a template's `${...}` holds: by id, else by name. */
export const templateVariable = (
    variables: Record<string, Variable>,
    inside: string,
    name: string | undefined
) =>
    Object.hasOwn(variables, inside) ? variables[inside] : variableNamed(variables, name ?? inside);

/** Text in which `${` reads as written in a template. */
export const escapeTemplate = (text: string): string => text.replaceAll('${', '\\${');

/**
 * The text `template` makes: each `${...}` naming a variable, or holding its id,
 * replaced by its value, a text variable's own template made too. A part naming no
 * variable, or a text variable leading back to itself, shows its name as written.
 */
export function renderTemplate(
    template: string,
    variables: Record<string, Variable>,
    within: string[] = []
): string {
    return template.replace(
        TEMPLATE_PART,
        (_, inside: string | undefined, name: string | undefined) => {
            if (inside === undefined) {
                return '${';
            }

            const variable = templateVariable(variables, inside, name);

            if (!variable) {
                return `\${${name ?? inside}}`;
            }

            if (within.includes(variable.id) || within.length >= TEMPLATE_DEPTH) {
                return `\${${variable.name}}`;
            }

            return variable.type === 'text'
                ? renderTemplate(variable.values.default, variables, [...within, variable.id])
                : String(variable.values.default);
        }
    );
}

/** The value a variable writes: a text variable's template made into text. */
export const variableValue = (variable: Variable, variables: Record<string, Variable>) =>
    variable.type === 'text'
        ? renderTemplate(variable.values.default, variables, [variable.id])
        : variable.values.default;

/** `template` as typed, with each variable it holds named instead. */
export const templateWithNames = (template: string, variables: Record<string, Variable>) =>
    template.replace(TEMPLATE_PART, (part, inside: string | undefined, name: string | undefined) =>
        inside === undefined
            ? part
            : `\${${templateVariable(variables, inside, name)?.name ?? name ?? inside}}`
    );

/** Typed `text` as a template, holding each variable it names by id, so renaming keeps it. */
export const templateWithIds = (text: string, variables: Record<string, Variable>) =>
    text.replace(TEMPLATE_PART, (part, inside: string | undefined, name: string | undefined) => {
        const variable =
            inside === undefined ? undefined : templateVariable(variables, inside, name);

        return variable ? `\${${variable.id}$${variable.name}}` : part;
    });

/**
 * Gives a text what `typed` makes, keeping `typed` as its template, with the
 * variables it names held by id, when it has a `${...}` or `\${`.
 */
export function writeText(shape: Text, typed: string, variables: Record<string, Variable>) {
    const template = templateWithIds(typed, variables);
    const value = renderTemplate(template, variables);

    if (!value.trim()) {
        return;
    }

    shape.value = value;

    if (template.search(TEMPLATE_PART) < 0) {
        delete shape.template;

        return;
    }

    shape.template = template;
}

/** The ids of the variables `template` holds, with those their text values hold. */
export function templateVariablesIds(
    template: string,
    variables: Record<string, Variable>,
    found = new Set<string>()
): Set<string> {
    for (const [, inside, name] of template.matchAll(TEMPLATE_PART)) {
        const variable =
            inside === undefined ? undefined : templateVariable(variables, inside, name);

        if (variable && !found.has(variable.id)) {
            found.add(variable.id);

            if (variable.type === 'text') {
                templateVariablesIds(variable.values.default, variables, found);
            }
        }
    }

    return found;
}

/**
 * `template` with each `${...}` holding an id replaced by what `replace` gives for
 * the id and the name it keeps, if anything.
 */
export const replaceInTemplate = (
    template: string,
    replace: (variableId: string, name: string | undefined) => string | undefined
) =>
    template.replace(
        TEMPLATE_PART,
        (part, inside: string | undefined, name: string | undefined) =>
            (inside === undefined ? undefined : replace(inside, name)) ?? part
    );
