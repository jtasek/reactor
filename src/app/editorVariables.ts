// What only the editor page shows of variables, so it loads with the page rather
// than with the store, which every page needs as it opens.
import type { Document, Shape, Variable } from './types';
import { accepts, bindableProperty, bindingHolds } from './variables';
import { resolveVariable } from './variableResolver';

/**
 * The variable `shape`'s `key` property follows: bound to it, and showing its value.
 * None when the variable is missing, as another copy may delete it, or holds a
 * value the property does not take.
 */
export function boundVariable(shape: Shape, key: string, document: Document): Variable | undefined {
    const variableId = shape.bindings?.[key];
    const variable = variableId === undefined ? undefined : document.variables[variableId];
    const property = bindableProperty(key);
    const value = variable && resolveVariable(variable, document.variables);

    return variable &&
        property &&
        value !== undefined &&
        accepts(property, value) &&
        bindingHolds(property, shape, value)
        ? variable
        : undefined;
}
