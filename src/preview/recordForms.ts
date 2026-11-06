import type { Document } from '../app/types';
import type { DataField, DataRecord, DataValue } from '../app/dataTypes';
import type { PreviewDrawing, PreviewNode } from './protocol';
import { dataFields, dataValueProblem } from '../app/data';

/** Lives in one mounted player only. Never enters the document, undo or collaboration. */
export interface RecordSession {
    documentId: string;
    records: Record<string, DataRecord>;
}

export function sessionDocument(document: Document, session: RecordSession): Document {
    if (document.id !== session.documentId) {
        return document;
    }
    const records = Object.fromEntries(
        Object.entries(session.records).flatMap(([id, edited]) => {
            const current = document.dataRecords[id];
            if (
                !current ||
                current.entityId !== edited.entityId ||
                !document.dataEntities[current.entityId]
            ) {
                return [];
            }
            const values = Object.fromEntries(
                Object.entries(edited.values).filter(([fieldId, value]) => {
                    const field = document.dataFields[fieldId];

                    return field?.entityId === current.entityId && !dataValueProblem(field, value);
                })
            );

            return [[id, { ...current, values: { ...current.values, ...values } }]];
        })
    );

    return { ...document, dataRecords: { ...document.dataRecords, ...records } };
}

/** Accept only a record actually rendered by the current detail screen. */
export function shownRecord(drawing: PreviewDrawing | null, screenId: unknown, value: unknown) {
    if (!value || typeof value !== 'object') {
        return undefined;
    }
    const { id, entityId } = value as Record<string, unknown>;
    if (typeof id !== 'string' || typeof entityId !== 'string') {
        return undefined;
    }
    const contains = (node: PreviewNode): boolean =>
        (node.recordEntity === entityId && Object.hasOwn(node.records ?? {}, id)) ||
        (node.children?.some(contains) ?? false);
    const screen = drawing?.screens.find((screen) => screen.id === screenId);

    return screen?.nodes.some(contains) ? { id, entityId } : undefined;
}

export function formValue(field: DataField, draft: string): DataValue {
    if (field.type === 'text') {
        return draft;
    }
    if (!draft.trim()) {
        return null;
    }
    if (field.type === 'boolean') {
        if (draft !== 'true' && draft !== 'false') {
            throw new Error(`${field.name} must be boolean.`);
        }

        return draft === 'true';
    }

    return Number(draft);
}

export function formFieldProblem(field: DataField, draft: string) {
    try {
        return dataValueProblem(field, formValue(field, draft));
    } catch (error) {
        return error instanceof Error ? error.message : 'Invalid value.';
    }
}

/** Validate the whole record first, then return a new local session in one step. */
export function saveRecord(
    document: Document,
    session: RecordSession,
    recordId: string,
    draft: Record<string, string>
): { session: RecordSession; problems: Record<string, string> } {
    const current = sessionDocument(document, session).dataRecords[recordId];
    if (!current || !document.dataEntities[current.entityId]) {
        return { session, problems: { record: 'This record is no longer available.' } };
    }
    const fields = dataFields(document, current.entityId);
    const problems: Record<string, string> = {};
    const values: Record<string, DataValue> = {};
    for (const field of fields) {
        const problem = formFieldProblem(field, draft[field.id] ?? '');
        if (problem) {
            problems[field.id] = problem;
            continue;
        }
        values[field.id] = formValue(field, draft[field.id] ?? '');
    }
    if (Object.keys(problems).length) {
        return { session, problems };
    }

    return {
        session: {
            documentId: document.id,
            records: {
                ...(session.documentId === document.id ? session.records : {}),
                [recordId]: { ...current, values }
            }
        },
        problems
    };
}
