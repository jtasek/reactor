import { json } from 'overmind';
import type { Document } from './types';
import { applyVariableChanges, buildVariable, escapeTemplate } from './variables';
import { resolveVariable, variableProblems, variableDefinition } from './variableResolver';

/** Editor-only mutation: follow a same-type source, or detach to the resolved literal. */
export function setVariableAlias(
    document: Document,
    variableId: string,
    sourceId: string | null
): string | undefined {
    const variable = document.variables[variableId];
    if (!variable || document.locked) {
        return 'This variable cannot be changed.';
    }
    const before = structuredClone(json(document.variables));
    const value = resolveVariable(variable, before);
    const next = buildVariable(
        variable.id,
        variable.name,
        variable.type,
        variable.type === 'text' ? escapeTemplate(String(value)) : value
    )!;
    const definition = variableDefinition(variable, before);
    if (next.type === 'color' && definition.type === 'color') {
        next.values = { ...definition.values };
        if (definition.dimensionId !== undefined) next.dimensionId = definition.dimensionId;
    }
    if (next.type === 'number' && definition.type === 'number') {
        next.values = { ...definition.values };

        if (definition.dimensionId !== undefined) {
            next.dimensionId = definition.dimensionId;
        }
    }
    if (sourceId !== null) {
        next.alias = sourceId;
        const problem = variableProblems(next, { ...before, [variableId]: next })[0];
        if (problem) {
            return problem;
        }
    }
    if (variable.source) next.source = { ...variable.source };
    document.variables[variableId] = next;
    applyVariableChanges(document, before);
}
