import type { Document, Shape, VariableContext } from './types';
import { boundVariable } from './editorVariables';
import { resolveVariable } from './variableResolver';
import { applyProperty } from './properties';
import { bindableProperty } from './variables';
import { variableContext } from './variableModes';

/** Paint-only projection. Defaults remain the source of geometry and durable bindings. */
export function themeColors(shape: Shape, document: Document, theme: VariableContext): Shape {
    if (!shape.bindings || Object.keys(theme).length === 0) {
        return shape;
    }

    const context = variableContext(document, theme);
    let result = shape;
    for (const key of ['fill', 'stroke', 'fontColor']) {
        const variable = boundVariable(shape, key, document);
        const property = bindableProperty(key);
        if (!variable || variable.type !== 'color' || !property) {
            continue;
        }

        const value = resolveVariable(variable, document.variables, context);
        if (value === property.read(shape, document)) {
            continue;
        }

        if (result === shape) {
            result = { ...shape };
        }

        applyProperty(property, result, value);
    }

    return result;
}
