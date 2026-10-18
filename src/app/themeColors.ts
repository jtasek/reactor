import type { Document, Shape, VariableContext } from './types';
import { boundVariable } from './editorVariables';
import { resolveVariable } from './variableResolver';
import { applyProperty } from './properties';
import { bindableProperty } from './variables';

/** Paint-only projection. Defaults remain the source of geometry and durable bindings. */
export function themeColors(shape: Shape, document: Document, theme: VariableContext): Shape {
    if (!shape.bindings) return shape;
    let result = shape;
    for (const key of ['fill', 'stroke', 'fontColor']) {
        const variable = boundVariable(shape, key, document);
        const property = bindableProperty(key);
        if (!variable || variable.type !== 'color' || !property) continue;
        const value = resolveVariable(variable, document.variables, theme);
        if (value === property.read(shape, document)) continue;
        if (result === shape) result = { ...shape };
        applyProperty(property, result, value);
    }
    return result;
}
