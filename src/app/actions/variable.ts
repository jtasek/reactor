import { json } from 'overmind';
import type { ActionWithParam, ActionWithParamAndResult, VariableType } from '../types';
import { applyProperty, canEdit } from '../properties';
import {
    applyVariableChanges,
    bindableProperty,
    buildVariable,
    canBind,
    escapeTemplate,
    replaceInTemplate,
    templateWithIds,
    unbind,
    variableNamed,
    variableValue
} from '../variables';

/**
 * Adds a variable to the current document and answers its id; none when `name` is
 * taken or may not name a variable, or `value` is not of `type`. Texts naming it
 * before it existed show its value.
 */
export const createVariable: ActionWithParamAndResult<
    { name: string; type: VariableType; value: unknown },
    string | undefined
> = ({ state, effects }, { name, type, value }) => {
    const document = state.currentDocument;
    const { variables } = document;
    const before = structuredClone(json(variables));
    const typed =
        type === 'text' && typeof value === 'string' ? templateWithIds(value, variables) : value;
    const variable = buildVariable(effects.newId(), name, type, typed);

    if (!variable || variableNamed(variables, name)) {
        return undefined;
    }

    variables[variable.id] = variable;
    applyVariableChanges(document, before);

    return variable.id;
};

/** Renames a variable, unless another has `name` or it may not name a variable. */
export const renameVariable: ActionWithParam<{ variableId: string; name: string }> = (
    { state },
    { variableId, name }
) => {
    const { variables } = state.currentDocument;
    const variable = variables[variableId];
    const renamed =
        variable && buildVariable(variableId, name, variable.type, variable.values.default);
    const other = variableNamed(variables, name);

    if (renamed && (!other || other.id === variableId)) {
        variable.name = name;
    }
};

/**
 * Gives a variable a value of its type, a text variable's as typed with names, and
 * writes into the shapes what it makes them: see `applyVariableChanges`.
 */
export const setVariableValue: ActionWithParam<{ variableId: string; value: unknown }> = (
    { state },
    { variableId, value }
) => {
    const document = state.currentDocument;
    const before = structuredClone(json(document.variables));
    const variable = before[variableId];
    const typed =
        variable?.type === 'text' && typeof value === 'string'
            ? templateWithIds(value, before)
            : value;
    const next = variable && buildVariable(variableId, variable.name, variable.type, typed);

    if (!next) {
        return;
    }

    document.variables[variableId] = next;
    applyVariableChanges(document, before);
};

/** Makes a property of the shapes that may change it follow a variable of its kind. */
export const bindProperty: ActionWithParam<{
    shapeIds: string[];
    key: string;
    variableId: string;
}> = ({ state }, { shapeIds, key, variableId }) => {
    const document = state.currentDocument;
    const property = bindableProperty(key);
    const variable = document.variables[variableId];

    if (!property || !variable) {
        return;
    }

    shapeIds.forEach((id) => {
        const shape = document.shapes[id];

        if (
            !shape ||
            !canEdit(property, shape, document) ||
            !canBind(property, shape, document, variable)
        ) {
            return;
        }

        applyProperty(property, shape, variableValue(variable, document.variables));
        shape.bindings ??= {};
        shape.bindings[key] = variableId;

        if (key === 'text' && shape.type === 'text') {
            delete shape.template;
        }
    });
};

/** Makes a property of the shapes stop following its variable, keeping its value. */
export const unbindProperty: ActionWithParam<{ shapeIds: string[]; key: string }> = (
    { state },
    { shapeIds, key }
) => {
    shapeIds.forEach((id) => {
        const shape = state.currentDocument.shapes[id];

        if (shape) {
            unbind(shape, key);
        }
    });
};

/**
 * Removes a variable. The properties that followed it keep its value, and the
 * templates holding it hold its value instead, so every shape looks as it did.
 */
export const deleteVariable: ActionWithParam<string> = ({ state }, variableId) => {
    const document = state.currentDocument;
    const before = structuredClone(json(document.variables));
    const variable = before[variableId];

    if (!variable) {
        return;
    }

    const value = escapeTemplate(String(variableValue(variable, before)));
    const inline = (template: string) =>
        replaceInTemplate(template, (inside) => (inside === variableId ? value : undefined));

    delete document.variables[variableId];
    Object.values(document.variables).forEach((other) => {
        if (other.type === 'text') {
            other.values.default = inline(other.values.default);
        }
    });
    Object.values(document.shapes).forEach((shape) => {
        if (shape.type === 'text' && shape.template !== undefined) {
            shape.template = inline(shape.template);
        }
    });
    applyVariableChanges(document, before);
};
