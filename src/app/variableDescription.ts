import type { Document, Variable, VariableContext } from './types';
import { variableContext } from './variableModes';
import { resolveVariable, variableDefinition, variableProblems } from './variableResolver';

/** Authored values remain separate from the value shown in a particular mode context. */
export function describeVariable(
    document: Document,
    variable: Variable,
    modes: VariableContext = {}
) {
    const context = variableContext(document, modes);
    const definition = variableDefinition(variable, document.variables);
    const dimensionId = definition.type === 'boolean' ? undefined : definition.dimensionId;
    const modeId = dimensionId ? context[dimensionId] : undefined;

    return {
        name: variable.name,
        type: variable.type,
        value: variable.values.default,
        ...(variable.type !== 'boolean' && variable.dimensionId
            ? {
                  dimensionId: variable.dimensionId,
                  modeValues: Object.fromEntries(
                      Object.entries(variable.values).filter(([key]) => key !== 'default')
                  )
              }
            : {}),
        ...(variable.alias === undefined ? {} : { alias: variable.alias }),
        resolved: {
            value: resolveVariable(variable, document.variables, context),
            definitionId: definition.id,
            ...(dimensionId
                ? {
                      dimensionId,
                      modeId:
                          context[dimensionId] ?? document.dimensions[dimensionId]?.defaultModeId
                  }
                : {}),
            usesBaseValue:
                definition.type === 'boolean' ||
                modeId === undefined ||
                definition.values[modeId] === undefined,
            problems: variableProblems(variable, document.variables)
        }
    };
}
