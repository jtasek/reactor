import type { Component, Document, Shape, Variable } from './types';
import type { DesignSystemPackage, ImportPlan, ImportPolicy } from './designSystemPackages';
import { planPackageImport, readDesignSystemPackage } from './designSystemPackages';
import { stageBatch } from './operationBatches';
import type { StagedBatch } from './operationBatches';
import { replaceTemplateIds, templateVariablesIds, variableDependencies } from './variables';

type Ids = { variables: Set<string>; dimensions: Set<string> };

function shapeTokens(shape: Shape, variables: Record<string, Variable>, ids: Ids) {
    Object.values(shape.bindings ?? {}).forEach((id) => ids.variables.add(id));
    if (shape.type === 'text' && shape.template) {
        templateVariablesIds(shape.template, variables, ids.variables);
    }
    if (shape.type === 'instance') {
        Object.values(shape.overrides).forEach((value) => {
            if (typeof value === 'string') {
                templateVariablesIds(value, variables, ids.variables);
            } else if (value && typeof value === 'object' && 'variableId' in value) {
                ids.variables.add(value.variableId);
            }
        });
        Object.keys(shape.modeOverrides ?? {}).forEach((id) => ids.dimensions.add(id));
    }
}

/** The variables and dimensions the members use, with the aliases and dimensions they need. */
export function memberTokens(document: Document, members: Shape[]): Ids {
    const ids: Ids = { variables: new Set(), dimensions: new Set() };
    members.forEach((shape) => shapeTokens(shape, document.variables, ids));
    for (const id of [...ids.variables]) {
        const variable = document.variables[id];
        if (!variable) {
            ids.variables.delete(id);
            continue;
        }
        variableDependencies(variable, document.variables, ids.variables);
    }
    for (const id of ids.variables) {
        const variable = document.variables[id];
        if (variable && variable.type !== 'boolean' && variable.dimensionId !== undefined) {
            ids.dimensions.add(variable.dimensionId);
        }
    }
    for (const id of ids.dimensions) {
        if (!document.dimensions[id]) {
            ids.dimensions.delete(id);
        }
    }
    return ids;
}

const membersOf = (component: Component) => Object.values(component.sourceShapes ?? {});

/** The library's own definitions for what the copied sources use, as a V4 package. */
export function libraryTokenPackage(
    source: Document,
    components: Component[]
): DesignSystemPackage | null {
    const ids = memberTokens(source, components.flatMap(membersOf));
    if (!ids.variables.size && !ids.dimensions.size) {
        return null;
    }
    return readDesignSystemPackage({
        format: 'reactor-design-system',
        version: 1,
        id: source.id,
        name: source.name.trim() || 'Library',
        variables: [...ids.variables].map((id) => source.variables[id]),
        dimensions: [...ids.dimensions].map((id) => source.dimensions[id])
    });
}

function remapShape(
    shape: Shape,
    variableIds: Map<string, string>,
    { dimensionIds, modeIds }: Pick<ImportPlan, 'dimensionIds' | 'modeIds'>
) {
    const variable = (id: string) => variableIds.get(id) ?? id;
    if (shape.bindings) {
        shape.bindings = Object.fromEntries(
            Object.entries(shape.bindings).map(([key, id]) => [key, variable(id)])
        );
    }
    if (shape.type === 'text' && shape.template) {
        shape.template = replaceTemplateIds(shape.template, (id) => variableIds.get(id));
    }
    if (shape.type === 'instance') {
        shape.overrides = Object.fromEntries(
            Object.entries(shape.overrides).map(([key, value]) => [
                key,
                typeof value === 'string'
                    ? replaceTemplateIds(value, (id) => variableIds.get(id))
                    : value && typeof value === 'object' && 'variableId' in value
                      ? { variableId: variable(value.variableId) }
                      : value
            ])
        );
        if (shape.modeOverrides) {
            shape.modeOverrides = Object.fromEntries(
                Object.entries(shape.modeOverrides).map(([id, mode]) => [
                    dimensionIds.get(id) ?? id,
                    modeIds.get(id)?.get(mode) ?? mode
                ])
            );
        }
    }
}

/**
 * Stages the library's tokens for its copied sources and points the copies at them. A first
 * copy reuses matching local definitions; an update replaces the ones from the same source.
 * Throws when the tokens cannot be brought, before anything is written.
 */
export function stageLibraryTokens(
    target: Document,
    source: Document,
    components: Component[],
    policy: Extract<ImportPolicy, 'reuse' | 'update'>,
    newId: () => string
): StagedBatch | undefined {
    const data = libraryTokenPackage(source, components);
    if (!data) {
        return undefined;
    }
    const plan = planPackageImport(target, data, policy, newId);
    const result = plan.operations.length ? stageBatch(target, plan.operations, newId) : undefined;
    if (result && !result.valid) {
        throw new Error(result.problem);
    }
    const created = result?.staged.ids ?? {};
    const variableIds = new Map(
        [...plan.variableIds].map(([id, key]) => [id, created[key] ?? key])
    );
    components.forEach((component) =>
        membersOf(component).forEach((shape) => remapShape(shape, variableIds, plan))
    );
    return result?.staged;
}
