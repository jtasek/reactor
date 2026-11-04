import type { Document } from './types';
import type { DataField, DataValue } from './dataTypes';

export const dataFields = (document: Document, entityId: string) =>
    Object.values(document.dataFields)
        .filter((field) => field.entityId === entityId)
        .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

export function dataValueProblem(
    field: DataField,
    value: DataValue | undefined
): string | undefined {
    if (
        value === null ||
        value === undefined ||
        (field.type === 'text' && typeof value === 'string' && !value.trim())
    ) {
        return field.required ? `${field.name} is required.` : undefined;
    }
    const expected = field.type === 'text' ? 'string' : field.type;
    if (typeof value !== expected || (typeof value === 'number' && !Number.isFinite(value))) {
        return `${field.name} must be ${field.type}.`;
    }

    return undefined;
}

/** Schema edits never coerce or discard authored record values. */
export function dataProblems(document: Document): string[] {
    const problems: string[] = [];
    const names = new Set<string>();
    for (const entity of Object.values(document.dataEntities)) {
        if (names.has(entity.name)) {
            problems.push(`Duplicate entity name: ${entity.name}.`);
        }
        names.add(entity.name);
        const fieldNames = new Set<string>();
        for (const field of dataFields(document, entity.id)) {
            if (fieldNames.has(field.name)) {
                problems.push(`${entity.name}: duplicate field name ${field.name}.`);
            }
            fieldNames.add(field.name);
        }
    }
    for (const field of Object.values(document.dataFields)) {
        if (!document.dataEntities[field.entityId]) {
            problems.push(`${field.name}: missing entity ${field.entityId}.`);
        }
    }
    for (const record of Object.values(document.dataRecords)) {
        if (!document.dataEntities[record.entityId]) {
            problems.push(`Record ${record.id}: missing entity ${record.entityId}.`);
        }
        for (const field of dataFields(document, record.entityId)) {
            const problem = dataValueProblem(field, record.values[field.id]);
            if (problem) {
                problems.push(`Record ${record.id}: ${problem}`);
            }
        }
        for (const id of Object.keys(record.values)) {
            if (document.dataFields[id]?.entityId !== record.entityId) {
                problems.push(`Record ${record.id}: unavailable field ${id}.`);
            }
        }
    }

    return problems;
}
