import type { Document } from './types';
import type { DataField, DataRecord, DataValue } from './dataTypes';

const byName = <T extends { id: string; name: string }>(a: T, b: T) =>
    a.name.localeCompare(b.name) || a.id.localeCompare(b.id);

export const dataFields = (document: Document, entityId: string) =>
    Object.values(document.dataFields)
        .filter((field) => field.entityId === entityId)
        .sort(byName);

/** An entity's records in the order they were added. */
export const dataRecords = (document: Document, entityId: string): DataRecord[] =>
    Object.values(document.dataRecords)
        .filter((record) => record.entityId === entityId)
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

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

/**
 * What concurrent deletes can leave behind: fields and records whose entity is gone, and
 * record values whose field is gone. Data View can't show these, so it offers to remove them.
 */
export function dataLeftovers(document: Document) {
    const fields = Object.values(document.dataFields)
        .filter((field) => !document.dataEntities[field.entityId])
        .map((field) => field.id);
    const records = Object.values(document.dataRecords)
        .filter((record) => !document.dataEntities[record.entityId])
        .map((record) => record.id);
    const values = Object.values(document.dataRecords)
        .filter((record) => document.dataEntities[record.entityId])
        .flatMap((record) =>
            Object.keys(record.values)
                .filter((id) => document.dataFields[id]?.entityId !== record.entityId)
                .map((fieldId) => ({ recordId: record.id, fieldId }))
        );

    return { fields, records, values };
}

/** Schema edits never coerce or discard authored record values. */
export function dataProblems(document: Document): string[] {
    const problems: string[] = [];
    const names = new Set<string>();
    const entities = Object.values(document.dataEntities).sort(byName);
    for (const entity of entities) {
        if (names.has(entity.name)) {
            problems.push(`Duplicate entity name: ${entity.name}.`);
        }
        names.add(entity.name);
        const fields = dataFields(document, entity.id);
        const fieldNames = new Set<string>();
        for (const field of fields) {
            if (fieldNames.has(field.name)) {
                problems.push(`${entity.name}: duplicate field name ${field.name}.`);
            }
            fieldNames.add(field.name);
        }
        // Rows are named as Data View numbers them.
        dataRecords(document, entity.id).forEach((record, index) => {
            for (const field of fields) {
                const problem = dataValueProblem(field, record.values[field.id]);
                if (problem) {
                    problems.push(`${entity.name} record ${index + 1}: ${problem}`);
                }
            }
        });
    }
    const leftovers = dataLeftovers(document);
    if (leftovers.fields.length + leftovers.records.length + leftovers.values.length) {
        problems.push(
            `Left over from deleted entities or fields: ${leftovers.fields.length} fields, ${leftovers.records.length} records, ${leftovers.values.length} values.`
        );
    }

    return problems;
}
