import type { Document, Shape, Variable } from 'src/app/types';
import { SHAPE_PROPERTIES, canEdit } from 'src/app/properties';
import { canBind, accepts } from 'src/app/variables';
import { resolveVariable, variableProblems } from 'src/app/variableResolver';
import type { UpdateShape } from 'src/app/operations';
import { parameterKey, readParameters } from './creation';

export const BINDING_PATTERN = /^(bind|unbind)\s+/i;
export const SHAPE_BINDING_KEYS = [
    'width',
    'height',
    'cornerRadius',
    'fill',
    'stroke',
    'fontColor',
    'text',
    'fontSize'
];

export interface BindingEdit {
    key: string;
    variable?: string;
}

export function bindingEdit(input: string): BindingEdit | undefined {
    const match = BINDING_PATTERN.exec(input.trim());
    if (!match) {
        return undefined;
    }

    const values = readParameters(` ${input.trim().slice(match[0].length)}`);
    const binding = match[1].toLowerCase() === 'bind';
    const allowed = binding ? ['property', 'variable'] : ['property'];
    if (
        Object.keys(values).some((key) => !allowed.includes(key)) ||
        !values.property?.trim() ||
        (binding && !values.variable?.trim())
    ) {
        throw new Error(
            binding
                ? 'Use bind property=fill variable="brand/primary".'
                : 'Use unbind property=fill.'
        );
    }
    const key = parameterKey(values.property.trim());

    return {
        key:
            key === 'value'
                ? 'text'
                : ['radius', 'cornerradius'].includes(key)
                  ? 'cornerRadius'
                  : key,
        ...(binding ? { variable: values.variable } : {})
    };
}

export function bindingVariable(document: Document, reference: string): Variable {
    const matches = Object.values(document.variables).filter(
        (variable) => variable.name === reference
    );
    const variable = Object.hasOwn(document.variables, reference)
        ? document.variables[reference]
        : matches.length === 1
          ? matches[0]
          : undefined;
    if (!variable) {
        throw new Error(
            matches.length > 1
                ? 'Several variables have this name. Choose a variable by ID.'
                : `Variable "${reference}" was not found.`
        );
    }
    const problems = variableProblems(variable, document.variables);
    if (problems.length) {
        throw new Error(
            `Resolve this variable’s reference problems first: ${problems.join(', ')}.`
        );
    }

    return variable;
}

/** Explicit fields detach one binding; restating the others preserves their identities. */
export function shapeBindingChanges(
    shape: Shape,
    document: Document,
    edit: BindingEdit
): UpdateShape['changes'] {
    const property = SHAPE_PROPERTIES.find((item) => item.key === edit.key);
    if (
        !SHAPE_BINDING_KEYS.includes(edit.key) ||
        !property ||
        property.read(shape, document) === undefined ||
        !canEdit(property, shape, document)
    ) {
        throw new Error(
            `${edit.key} cannot be bound on ${shape.name}. Check its type, sizing and locks.`
        );
    }
    if (edit.variable === undefined && !shape.bindings?.[edit.key]) {
        return { bindings: { ...shape.bindings } };
    }

    const bindings = { ...shape.bindings };
    delete bindings[edit.key];
    if (edit.variable !== undefined) {
        const variable = bindingVariable(document, edit.variable);
        const value = resolveVariable(variable, document.variables);
        if (!canBind(property, shape, document, variable) || !accepts(property, value)) {
            throw new Error(
                `${variable.name} is not compatible with ${property.label} on ${shape.name}.`
            );
        }
        bindings[edit.key] = variable.id;
    }
    const field =
        edit.key === 'text' ? 'value' : ['width', 'height'].includes(edit.key) ? 'size' : edit.key;
    // Missing styles need no explicit detach: an existing binding always has a held value.
    const held = shape[field as keyof Shape];

    return {
        ...(held !== undefined ? { [field]: JSON.parse(JSON.stringify(held)) } : {}),
        bindings
    };
}
