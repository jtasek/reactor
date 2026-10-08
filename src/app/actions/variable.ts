import type { ActionWithParam, ActionWithParamAndResult, VariableType } from '../types';
import { applyProperty, canEdit } from '../properties';
import {
    bindableProperty,
    bindingHolds,
    buildVariable,
    canBind,
    shapesBoundTo,
    unbind,
    variableNamed
} from '../variables';

/**
 * Adds a variable to the current document and answers its id; none when `name` is
 * taken or may not name a variable, or `value` is not of `type`.
 */
export const createVariable: ActionWithParamAndResult<
    { name: string; type: VariableType; value: unknown },
    string | undefined
> = ({ state, effects }, { name, type, value }) => {
    const { variables } = state.currentDocument;
    const variable = buildVariable(effects.newId(), name, type, value);

    if (!variable || variableNamed(variables, name)) {
        return undefined;
    }

    variables[variable.id] = variable;

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
 * Gives a variable a value of its type and writes it into the properties that
 * follow it. A property set otherwise since, as by a drag, no longer follows it.
 */
export const setVariableValue: ActionWithParam<{ variableId: string; value: unknown }> = (
    { state },
    { variableId, value }
) => {
    const document = state.currentDocument;
    const variable = document.variables[variableId];
    const next = variable && buildVariable(variableId, variable.name, variable.type, value);

    if (!next) {
        return;
    }

    shapesBoundTo(document, variableId).forEach(({ shape, keys }) =>
        keys.forEach((key) => {
            const property = bindableProperty(key);

            if (property && bindingHolds(property, shape, variable)) {
                applyProperty(property, shape, next.values.default);

                return;
            }

            unbind(shape, key);
        })
    );
    document.variables[variableId] = next;
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

        applyProperty(property, shape, variable.values.default);
        shape.bindings ??= {};
        shape.bindings[key] = variableId;
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

/** Removes a variable; the properties that followed it keep its value. */
export const deleteVariable: ActionWithParam<string> = ({ state }, variableId) => {
    const document = state.currentDocument;

    shapesBoundTo(document, variableId).forEach(({ shape, keys }) =>
        keys.forEach((key) => unbind(shape, key))
    );
    delete document.variables[variableId];
};
