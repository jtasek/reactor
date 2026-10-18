import { json } from 'overmind';
import type {
    ActionWithParam,
    ActionWithParamAndResult,
    Document,
    VariableDimension
} from './types';
import { readDimension, ordered } from './variableModes';
import { isHexColor } from './utils';
import { applyVariableChanges } from './variables';

const validName = (name: string) => name.trim().length > 0 && name.trim().length <= 200;

/**
 * The default mode's colors are the base values shapes hold. Making `to` the default moves
 * each of its colors into the base, writing them into the shapes, and keeps the old base as
 * `from`'s color while `from` is still a mode.
 */
function promoteDefaultMode(document: Document, dimensionId: string, from: string, to: string) {
    const before = structuredClone(json(document.variables));
    Object.values(document.variables).forEach((variable) => {
        if (variable.type !== 'color' || variable.dimensionId !== dimensionId) return;
        const color = variable.values[to];
        if (color === undefined) return;
        if (document.dimensions[dimensionId]?.modes[from]) {
            variable.values[from] = variable.values.default;
        }
        variable.values.default = color;
        delete variable.values[to];
    });
    applyVariableChanges(document, before);
}

export const createDimension: ActionWithParamAndResult<string, string | undefined> = (
    { state, effects },
    name
) => {
    const document = state.currentDocument;
    if (
        document.locked ||
        !validName(name) ||
        Object.values(document.dimensions).some((d) => d.name === name.trim())
    )
        return;
    const id = effects.newId();
    const modeId = effects.newId();
    document.dimensions[id] = {
        id,
        name: name.trim(),
        order: Object.keys(document.dimensions).length,
        defaultModeId: modeId,
        modes: { [modeId]: { id: modeId, name: 'Default', order: 0 } }
    };
    return id;
};

export const updateDimension: ActionWithParam<VariableDimension> = ({ state }, input) => {
    const document = state.currentDocument;
    if (document.locked || !document.dimensions[input.id]) return;
    let dimension: VariableDimension;
    try {
        dimension = readDimension(input);
    } catch {
        return;
    }
    if (
        Object.values(document.dimensions).some(
            (d) => d.id !== dimension.id && d.name === dimension.name
        )
    )
        return;
    const previousDefault = document.dimensions[dimension.id].defaultModeId;
    document.dimensions[dimension.id] = dimension;
    if (dimension.defaultModeId !== previousDefault) {
        promoteDefaultMode(document, dimension.id, previousDefault, dimension.defaultModeId);
    }
};

export const addDimensionMode: ActionWithParam<{ dimensionId: string; name: string }> = (
    { state, effects },
    { dimensionId, name }
) => {
    const dimension = state.currentDocument.dimensions[dimensionId];
    if (
        state.currentDocument.locked ||
        !dimension ||
        !validName(name) ||
        Object.values(dimension.modes).some((m) => m.name === name.trim()) ||
        Object.keys(dimension.modes).length >= 100
    )
        return;
    const id = effects.newId();
    dimension.modes[id] = {
        id,
        name: name.trim(),
        order: Math.max(...Object.values(dimension.modes).map((m) => m.order)) + 1
    };
};

export const deleteDimensionMode: ActionWithParam<{ dimensionId: string; modeId: string }> = (
    { state },
    { dimensionId, modeId }
) => {
    const document = state.currentDocument;
    const dimension = document.dimensions[dimensionId];
    if (document.locked || !dimension?.modes[modeId] || Object.keys(dimension.modes).length < 2)
        return;
    delete dimension.modes[modeId];
    Object.values(document.variables).forEach((variable) => {
        if (variable.type === 'color' && variable.dimensionId === dimensionId)
            delete variable.values[modeId];
    });
    if (dimension.defaultModeId === modeId) {
        dimension.defaultModeId = ordered(dimension.modes)[0].id;
        promoteDefaultMode(document, dimensionId, modeId, dimension.defaultModeId);
    }
};

export const deleteDimension: ActionWithParam<string> = ({ state }, dimensionId) => {
    const document = state.currentDocument;
    if (document.locked || !document.dimensions[dimensionId]) return;
    delete document.dimensions[dimensionId];
    Object.values(document.variables).forEach((variable) => {
        if (variable.type === 'color' && variable.dimensionId === dimensionId) {
            delete variable.dimensionId;
            variable.values = { default: variable.values.default };
        }
    });
};

export const setVariableDimension: ActionWithParam<{
    variableId: string;
    dimensionId: string | null;
}> = ({ state }, { variableId, dimensionId }) => {
    const document = state.currentDocument;
    const variable = document.variables[variableId];
    if (
        document.locked ||
        variable?.type !== 'color' ||
        variable.alias !== undefined ||
        (dimensionId !== null && !document.dimensions[dimensionId]) ||
        variable.dimensionId === dimensionId
    )
        return;
    variable.values = { default: variable.values.default };
    if (dimensionId === null) delete variable.dimensionId;
    else variable.dimensionId = dimensionId;
};

export const setVariableModeValue: ActionWithParam<{
    variableId: string;
    modeId: string;
    value: string | null;
}> = ({ state }, { variableId, modeId, value }) => {
    const document = state.currentDocument;
    const variable = document.variables[variableId];
    if (
        document.locked ||
        variable?.type !== 'color' ||
        variable.alias !== undefined ||
        !variable.dimensionId ||
        !document.dimensions[variable.dimensionId]?.modes[modeId] ||
        document.dimensions[variable.dimensionId].defaultModeId === modeId
    )
        return;
    if (value === null) delete variable.values[modeId];
    else if (isHexColor(value)) variable.values[modeId] = value;
};

export const setPreviewMode: ActionWithParam<{ dimensionId: string; modeId: string }> = (
    { state },
    { dimensionId, modeId }
) => {
    const document = state.currentDocument;
    if (!document.dimensions[dimensionId]?.modes[modeId]) return;
    state.previewModes[document.id] = {
        ...json(state.previewModes[document.id] ?? {}),
        [dimensionId]: modeId
    };
};
