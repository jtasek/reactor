// What only the editor page shows of variables, so it loads with the page rather
// than with the store, which every page needs as it opens.
import type { Document, Shape, Variable } from './types';
import {
    TEMPLATE_DEPTH,
    TEMPLATE_PART,
    accepts,
    bindableProperty,
    bindingHolds,
    templateVariable,
    variableValue
} from './variables';

/**
 * The variable `shape`'s `key` property follows: bound to it, and showing its value.
 * None when the variable is missing, as another copy may delete it, or holds a
 * value the property does not take.
 */
export function boundVariable(shape: Shape, key: string, document: Document): Variable | undefined {
    const variableId = shape.bindings?.[key];
    const variable = variableId === undefined ? undefined : document.variables[variableId];
    const property = bindableProperty(key);
    const value = variable && variableValue(variable, document.variables);

    return variable &&
        property &&
        value !== undefined &&
        accepts(property, value) &&
        bindingHolds(property, shape, value)
        ? variable
        : undefined;
}

/** The names in `template` that name no variable, or text variables leading back to themselves. */
export function templateProblems(
    template: string,
    variables: Record<string, Variable>,
    within: string[] = []
): string[] {
    return [...template.matchAll(TEMPLATE_PART)].flatMap(([, inside, name]) => {
        if (inside === undefined) {
            return [];
        }

        const variable = templateVariable(variables, inside, name);

        if (!variable) {
            return [name ?? inside];
        }

        if (within.includes(variable.id) || within.length >= TEMPLATE_DEPTH) {
            return [variable.name];
        }

        return variable.type === 'text'
            ? templateProblems(variable.values.default, variables, [...within, variable.id])
            : [];
    });
}
