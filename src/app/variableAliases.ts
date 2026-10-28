import { json } from 'overmind';
import type { Document, Variable } from './types';
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
    if (next.type === 'text' && definition.type === 'text') {
        next.values = {
            default: next.values.default,
            ...Object.fromEntries(
                Object.keys(definition.values)
                    .filter((mode) => mode !== 'default')
                    .map((mode) => [
                        mode,
                        escapeTemplate(
                            String(
                                resolveVariable(
                                    variable,
                                    before,
                                    definition.dimensionId ? { [definition.dimensionId]: mode } : {}
                                )
                            )
                        )
                    ])
            )
        };
        if (definition.dimensionId !== undefined) {
            next.dimensionId = definition.dimensionId;
        }
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

/**
 * Keeps the mode values `next` replaces when only its base value is edited. A text
 * that followed a source keeps what each mode showed, as literal text.
 */
export function keepModeValues(
    next: Variable,
    variable: Variable,
    before: Record<string, Variable>
) {
    const definition = variableDefinition(variable, before);
    if (next.type === 'boolean' || next.type !== definition.type) {
        return;
    }
    const dimensionId = definition.dimensionId;
    const modes = Object.keys(definition.values).filter((mode) => mode !== 'default');
    const values = Object.fromEntries(
        modes.map((mode) => [
            mode,
            next.type === 'text' && variable.alias !== undefined
                ? escapeTemplate(
                      String(
                          resolveVariable(
                              variable,
                              before,
                              dimensionId ? { [dimensionId]: mode } : {}
                          )
                      )
                  )
                : definition.values[mode]
        ])
    );
    next.values = { ...values, default: next.values.default } as typeof next.values;
    if (dimensionId !== undefined) {
        next.dimensionId = dimensionId;
    }
}
