import type { Document } from './types';
import type { DataField, DataRecord, DataValue } from './dataTypes';

/** Per entity; more slows Data View and the player without helping a prototype. */
export const MAX_RECORDS_PER_ENTITY = 1000;

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

/** Text, choice and reference values are strings; an empty one counts as not set. */
const valueType = (field: DataField) =>
    field.type === 'number' || field.type === 'boolean' ? field.type : 'string';

/** Checks a value against its field; reference values also need the document's records. */
export function dataValueProblem(
    document: Pick<Document, 'dataRecords'>,
    field: DataField,
    value: DataValue | undefined
): string | undefined {
    if (
        value === null ||
        value === undefined ||
        (typeof value === 'string' && valueType(field) === 'string' && !value.trim())
    ) {
        return field.required ? `${field.name} is required.` : undefined;
    }
    if (
        typeof value !== valueType(field) ||
        (typeof value === 'number' && !Number.isFinite(value))
    ) {
        return `${field.name} must be ${field.type === 'reference' ? 'a record' : field.type}.`;
    }
    if (field.type === 'choice' && !field.options?.includes(value as string)) {
        return `${field.name} must be one of its options.`;
    }
    if (field.type === 'reference') {
        const target = document.dataRecords[value as string];
        if (!target || target.entityId !== field.targetEntityId) {
            return `${field.name} refers to a record that no longer exists.`;
        }
    }

    return undefined;
}

/** The text field that names an entity's records: the chosen one, else the first. */
export function labelField(document: Document, entityId: string): DataField | undefined {
    const chosen = document.dataFields[document.dataEntities[entityId]?.labelFieldId ?? ''];

    return chosen?.entityId === entityId && chosen.type === 'text'
        ? chosen
        : dataFields(document, entityId).find((field) => field.type === 'text');
}

/** How a reference shows a record: its label field, else its row number as Data View shows it. */
export function recordLabel(document: Document, recordId: string): string {
    const record = document.dataRecords[recordId];
    if (!record) {
        return 'Missing record';
    }
    const records = dataRecords(document, record.entityId);

    return labelOf(
        document,
        record,
        records.findIndex((item) => item.id === recordId),
        labelField(document, record.entityId)
    );
}

function labelOf(document: Document, record: DataRecord, index: number, label?: DataField) {
    const value = record.values[label?.id ?? ''];

    return typeof value === 'string' && value.trim()
        ? value
        : `${document.dataEntities[record.entityId]?.name ?? 'Record'} ${index + 1}`;
}

/** The values a choice or reference field offers, for Data View and record forms. */
export function fieldChoices(document: Document, field: DataField) {
    if (field.type === 'choice') {
        return (field.options ?? []).map((option) => ({ value: option, label: option }));
    }
    if (field.type === 'reference' && field.targetEntityId) {
        const label = labelField(document, field.targetEntityId);

        return dataRecords(document, field.targetEntityId).map((record, index) => ({
            value: record.id,
            label: labelOf(document, record, index, label)
        }));
    }

    return [];
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
            if (field.type === 'choice' && !field.options?.length) {
                problems.push(`${entity.name}: ${field.name} has no options.`);
            }
            if (field.type === 'reference' && !document.dataEntities[field.targetEntityId ?? '']) {
                problems.push(`${entity.name}: ${field.name} refers to a deleted entity.`);
            }
        }
        const records = dataRecords(document, entity.id);
        if (records.length > MAX_RECORDS_PER_ENTITY) {
            problems.push(
                `${entity.name} has ${records.length} records; entities hold up to ${MAX_RECORDS_PER_ENTITY.toLocaleString('en-US')}.`
            );
        }
        // Rows are named as Data View numbers them.
        records.forEach((record, index) => {
            for (const field of fields) {
                const problem = dataValueProblem(document, field, record.values[field.id]);
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
