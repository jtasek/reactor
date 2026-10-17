import { json } from 'overmind';
import type { Document } from './types';
import { applyVariableChanges, buildVariable, escapeTemplate } from './variables';
import { resolveVariable, variableProblems } from './variableResolver';

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
    if (sourceId !== null) {
        next.alias = sourceId;
        const problem = variableProblems(next, { ...before, [variableId]: next })[0];
        if (problem) {
            return problem;
        }
    }
    document.variables[variableId] = next;
    applyVariableChanges(document, before);
}
