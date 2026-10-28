import type { Document, PackageIdentity, Variable, VariableDimension } from './types';
import type { Operation } from './operations';
import { readEntity } from './services/documentStorage';
import { readDimension } from './variableModes';
import { readPackageIdentity } from './packageIdentity';
import { variableProblems } from './variableResolver';
import { replaceTemplateIds, templateWithIds } from './variables';
import { stageBatch } from './operationBatches';

export const PACKAGE_MAX_BYTES = 1024 * 1024;
const MAX_RECORDS = 1000;
const FORMAT = 'reactor-design-system';
export interface DesignSystemPackage {
    format: typeof FORMAT;
    version: 1;
    id: string;
    name: string;
    variables: Variable[];
    dimensions: VariableDimension[];
}
export type ImportChoice = 'reuse' | 'replace' | 'separate';
type RecordWithIdentity = { id: string; name: string; source?: PackageIdentity };
const identity = (record: RecordWithIdentity, packageId: string) =>
    record.source ?? { packageId, tokenId: record.id };
const identityKey = (source: PackageIdentity) => JSON.stringify([source.packageId, source.tokenId]);
const sorted = <T extends { id: string }>(records: T[]) =>
    [...records].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
const table = <T extends { id: string }>(records: T[]) =>
    Object.fromEntries(records.map((record) => [record.id, record]));

function unique(records: RecordWithIdentity[], packageId: string) {
    for (const values of [
        records.map((r) => r.id),
        records.map((r) => r.name),
        records.map((r) => identityKey(identity(r, packageId)))
    ]) {
        if (new Set(values).size !== values.length)
            throw new Error('Duplicate package IDs, names or token identities.');
    }
}

/** Reject a broken graph instead of silently repairing or flattening its definitions. */
export function readDesignSystemPackage(input: unknown): DesignSystemPackage {
    if (!input || typeof input !== 'object') throw new Error('Expected a design-system package.');
    const p = input as Record<string, unknown>;
    if (p.format !== FORMAT || p.version !== 1)
        throw new Error('Unsupported design-system package format or version.');
    const { packageId: id } = readPackageIdentity({ packageId: p.id, tokenId: p.id });
    if (typeof p.name !== 'string' || !p.name.trim()) throw new Error('The package needs a name.');
    if (
        !Array.isArray(p.variables) ||
        !Array.isArray(p.dimensions) ||
        p.variables.length + p.dimensions.length > MAX_RECORDS
    )
        throw new Error(`A package must contain at most ${MAX_RECORDS} variables and dimensions.`);
    const dimensions = sorted(p.dimensions.map(readDimension));
    for (const dimension of dimensions) {
        if (!Object.hasOwn(dimension.modes, dimension.defaultModeId))
            throw new Error(`Invalid default mode for ${dimension.name}.`);
    }
    const variables = sorted(
        p.variables.map((raw) => {
            const variable = readEntity('variables', raw);
            if (/[{}$]/.test(variable.id))
                throw new Error('Invalid token ID for template references.');
            // The durable reader repairs orphan modes; a package must not need repairs.
            if (
                JSON.stringify(Object.keys(raw.values).sort()) !==
                JSON.stringify(Object.keys(variable.values).sort())
            )
                throw new Error(`Invalid mode values for ${variable.name}.`);
            return { ...variable, source: identity(variable, id) };
        })
    );
    const byId = table(variables);
    const dimensionsById = table(dimensions);
    unique(variables, id);
    unique(dimensions, id);
    for (const variable of variables) {
        const issues = variableProblems(variable, byId);
        // A missing alias source later exposes this retained fallback. Validate it too.
        if (variable.type === 'text' && variable.alias !== undefined)
            issues.push(...variableProblems({ ...variable, alias: undefined }, byId));
        if (issues.length) throw new Error(`${variable.name}: ${issues.join(', ')}.`);
        if (variable.type !== 'boolean') {
            const dimension =
                variable.dimensionId === undefined
                    ? undefined
                    : dimensionsById[variable.dimensionId];
            if (
                variable.dimensionId !== undefined &&
                !Object.hasOwn(dimensionsById, variable.dimensionId)
            )
                throw new Error(`Missing dimension for ${variable.name}.`);
            for (const mode of Object.keys(variable.values).filter((key) => key !== 'default')) {
                if (
                    !dimension ||
                    !Object.hasOwn(dimension.modes, mode) ||
                    mode === dimension.defaultModeId
                )
                    throw new Error(`Invalid mode ${mode} for ${variable.name}.`);
            }
        }
        if (variable.type === 'text') {
            Object.keys(variable.values).forEach((mode) => {
                variable.values[mode] = templateWithIds(variable.values[mode], byId);
            });
        }
    }
    return {
        format: FORMAT,
        version: 1,
        id,
        name: p.name.trim(),
        variables,
        dimensions: dimensions.map((d) => ({ ...d, source: identity(d, id) }))
    };
}

export function parseDesignSystemPackage(text: string): DesignSystemPackage {
    if (new TextEncoder().encode(text).length > PACKAGE_MAX_BYTES)
        throw new Error('The package is larger than 1 MiB.');
    return readDesignSystemPackage(JSON.parse(text));
}

/** Export only definitions; no selection, preview context, shapes or account data. */
export function exportDesignSystemPackage(document: Document): string {
    const data = readDesignSystemPackage({
        format: FORMAT,
        version: 1,
        id: document.id,
        name: document.name,
        variables: Object.values(document.variables),
        dimensions: Object.values(document.dimensions)
    });
    // Canonicalize object keys too, so insertion order and collaboration do not change exports.
    const canonical = (value: unknown): unknown => {
        if (Array.isArray(value)) return value.map(canonical);
        if (value && typeof value === 'object')
            return Object.fromEntries(
                Object.entries(value)
                    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
                    .map(([key, item]) => [key, canonical(item)])
            );
        return value;
    };
    const text = `${JSON.stringify(canonical(data), null, 2)}\n`;
    if (new TextEncoder().encode(text).length > PACKAGE_MAX_BYTES)
        throw new Error('The package is larger than 1 MiB.');
    return text;
}

export function packageMatches<T extends RecordWithIdentity>(
    incoming: T,
    existing: Record<string, T>,
    documentId: string
): T[] {
    const all = Object.values(existing);
    const byIdentity = all.filter(
        (record) => identityKey(identity(record, documentId)) === identityKey(incoming.source!)
    );
    return byIdentity.length ? byIdentity : all.filter((record) => record.name === incoming.name);
}

/** A reviewed plan is rebuilt against the current document immediately before applying. */
export function planDesignSystemImport(
    document: Document,
    input: DesignSystemPackage,
    choice: ImportChoice,
    newId: () => string
): Operation[] {
    if (document.locked) throw new Error('This document is locked.');
    const data = readDesignSystemPackage(input);
    const operations: Operation[] = [];
    const variableIds = new Map<string, string>();
    const dimensionIds = new Map<string, string>();
    const takenNames = new Set(Object.values(document.variables).map((v) => v.name));
    const dimensionNames = new Set(Object.values(document.dimensions).map((d) => d.name));
    const freshName = (name: string, taken: Set<string>) => {
        let result = name;
        let suffix = 2;
        while (taken.has(result)) result = `${name} ${suffix++}`;
        taken.add(result);
        return result;
    };
    const match = <T extends RecordWithIdentity>(incoming: T, existing: Record<string, T>) => {
        if (choice === 'separate') return undefined;
        const matches = packageMatches(incoming, existing, document.id);
        if (matches.length > 1)
            throw new Error(`Several records match ${incoming.name}. Import separately instead.`);
        return matches[0];
    };
    for (const dimension of data.dimensions) {
        const existing = match(dimension, document.dimensions);
        const id = existing?.id ?? newId();
        dimensionIds.set(dimension.id, id);
        if (existing && choice === 'reuse') continue;
        const name = existing ? dimension.name : freshName(dimension.name, dimensionNames);
        operations.push({
            op: 'setDimension',
            dimension: {
                ...dimension,
                id,
                name,
                ...(choice === 'separate' ? { source: undefined } : {})
            }
        });
    }
    const matched = new Map<string, Variable>();
    for (const variable of data.variables) {
        const existing = match(variable, document.variables);
        if (existing && existing.type !== variable.type)
            throw new Error(`${variable.name} has a different type. Import separately instead.`);
        if (existing) matched.set(variable.id, existing);
        variableIds.set(variable.id, existing?.id ?? newId());
    }
    // Sources must precede their aliases; template references can point forward.
    const pending = new Map(data.variables.map((v) => [v.id, v]));
    const ordered: Variable[] = [];
    const visit = (variable: Variable) => {
        if (!pending.delete(variable.id)) return;
        const source = variable.alias && pending.get(variable.alias);
        if (source) visit(source);
        ordered.push(variable);
    };
    data.variables.forEach(visit);
    for (const variable of ordered) {
        const existing = matched.get(variable.id);
        if (existing && choice === 'reuse') continue;
        const name = existing ? variable.name : freshName(variable.name, takenNames);
        const value =
            variable.type === 'text'
                ? replaceTemplateIds(variable.values.default, (id) => variableIds.get(id))
                : variable.values.default;
        const color =
            variable.type !== 'boolean'
                ? {
                      dimensionId: variable.dimensionId
                          ? dimensionIds.get(variable.dimensionId)!
                          : null,
                      modeValues: Object.fromEntries(
                          Object.entries(variable.values)
                              .filter(([key]) => key !== 'default')
                              .map(([key, value]) => [
                                  key,
                                  variable.type === 'text'
                                      ? replaceTemplateIds(String(value), (id) =>
                                            variableIds.get(id)
                                        )
                                      : value
                              ])
                      )
                  }
                : {};
        const alias = variable.alias === undefined ? null : variableIds.get(variable.alias)!;
        const source = choice === 'separate' ? undefined : variable.source;
        operations.push(
            existing
                ? {
                      op: 'updateVariable',
                      variable: existing.id,
                      name,
                      value,
                      alias,
                      source,
                      ...color
                  }
                : {
                      op: 'addVariable',
                      key: variableIds.get(variable.id)!,
                      name,
                      type: variable.type,
                      value,
                      source,
                      ...(alias === null ? {} : { alias }),
                      ...(variable.type !== 'boolean'
                          ? { ...color, dimensionId: color.dimensionId ?? undefined }
                          : {})
                  }
        );
    }
    if (operations.length) {
        let checked = 0;
        const result = stageBatch(document, operations, () => `package-check-${checked++}`);
        if (!result.valid) throw new Error(result.problem);
        const projected = {
            ...document.variables,
            ...table(result.staged.variables),
            ...table(result.staged.updatedVariables)
        };
        for (const variable of Object.values(projected)) {
            const before = document.variables[variable.id];
            const existingProblems = before ? variableProblems(before, document.variables) : [];
            const issues = variableProblems(variable, projected).filter(
                (issue) => !existingProblems.includes(issue)
            );
            if (issues.length) throw new Error(`${variable.name}: ${issues.join(', ')}.`);
        }
    }
    return operations;
}
