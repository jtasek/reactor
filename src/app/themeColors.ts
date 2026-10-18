import type { Document, Shape, Theme } from './types';
import { boundVariable } from './editorVariables';
import { resolveVariable } from './variableResolver';
import { applyProperty } from './properties';
import { bindableProperty } from './variables';

/** Paint-only projection. Defaults remain the source of geometry and durable bindings. */
export function themeColors(shape: Shape, document: Document, theme: Theme): Shape {
    if (theme === 'light' || !shape.bindings) return shape;
    let result = shape;
    for (const key of ['fill', 'stroke', 'fontColor']) {
        const variable = boundVariable(shape, key, document);
        const property = bindableProperty(key);
        if (!variable || variable.type !== 'color' || !property) continue;
        if (result === shape) result = { ...shape };
        applyProperty(property, result, resolveVariable(variable, document.variables, theme));
    }
    return result;
}
