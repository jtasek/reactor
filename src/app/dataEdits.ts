import type { ActionWithParamAndResult, Document } from './types';
import type { DataField, DataType, DataValue, DataList } from './dataTypes';
import { isReadOnly } from './documentAccess';
import { readEntity, readDataList } from './services/documentStorage';
import { dataLeftovers, dataRecords, dataValueProblem } from './data';
import { dataListProblems } from './dataLists';
import { isShapeLocked } from './utils';

export type DataChange =
    | { kind: 'setList'; instanceId: string; list: DataList | null }
    | { kind: 'addEntity'; name: string }
    | { kind: 'renameEntity'; id: string; name: string }
    | { kind: 'deleteEntity'; id: string }
    | { kind: 'addField'; entityId: string; name: string; type: DataType; required: boolean }
    | {
          kind: 'updateField';
          id: string;
          changes: Partial<Pick<DataField, 'name' | 'type' | 'required'>>;
      }
    | { kind: 'deleteField'; id: string }
    | { kind: 'addRecord'; entityId: string }
    | { kind: 'deleteRecord'; id: string }
    | { kind: 'setValue'; recordId: string; fieldId: string; value: DataValue }
    | { kind: 'removeLeftovers' };
export type DataEdit = DataChange & { documentId: string };
export type DataEditResult = { applied: true; id?: string } | { applied: false; problem: string };

function entity(document: Document, id: string) {
    if (!document.dataEntities[id]) {
        throw new Error('This entity no longer exists.');
    }
}

function uniqueName(items: { id: string; name: string }[], name: string, id: string) {
    if (items.some((item) => item.id !== id && item.name === name)) {
        throw new Error('This name is already in use.');
    }
}

/** Prepare first; a validated edit is one collaboration/undo transaction. */
function prepare(
    document: Document,
    edit: DataChange,
    newId: () => string
): { id?: string; write: () => void } {
    if (edit.kind === 'setList') {
        const instance = document.shapes[edit.instanceId];
        if (instance?.type !== 'instance' || isShapeLocked(document, instance.id)) {
            throw new Error('Select an unlocked component instance.');
        }
        const list = edit.list === null ? undefined : readDataList(edit.list);
        const previous = instance.dataList;
        const changed = list && {
            ...list,
            fields: Object.fromEntries(
                Object.entries(list.fields).filter(
                    ([prop, field]) =>
                        list.entityId !== previous?.entityId || previous.fields[prop] !== field
                )
            )
        };
        const problems = changed ? dataListProblems(document, instance, changed) : [];
        if (problems.length) {
            throw new Error(problems.join(' '));
        }

        return {
            write: () => {
                if (!list) {
                    delete instance.dataList;

                    return;
                }
                instance.dataList = list;
            }
        };
    }
    if (edit.kind === 'addEntity' || edit.kind === 'renameEntity') {
        const id = edit.kind === 'addEntity' ? newId() : edit.id;
        if (edit.kind === 'renameEntity') {
            entity(document, id);
        }
        const value = readEntity('dataEntities', { id, name: edit.name });
        uniqueName(Object.values(document.dataEntities), value.name, id);

        return {
            id,
            write: () => {
                if (document.dataEntities[id]) {
                    document.dataEntities[id].name = value.name;

                    return;
                }
                document.dataEntities[id] = value;
            }
        };
    }
    if (edit.kind === 'deleteEntity') {
        entity(document, edit.id);

        return {
            write: () => {
                Object.values(document.dataFields)
                    .filter((field) => field.entityId === edit.id)
                    .forEach((field) => delete document.dataFields[field.id]);
                Object.values(document.dataRecords)
                    .filter((record) => record.entityId === edit.id)
                    .forEach((record) => delete document.dataRecords[record.id]);
                delete document.dataEntities[edit.id];
            }
        };
    }
    if (edit.kind === 'addField' || edit.kind === 'updateField') {
        const previous = edit.kind === 'updateField' ? document.dataFields[edit.id] : undefined;
        if (edit.kind === 'updateField' && !previous) {
            throw new Error('This field no longer exists.');
        }
        const field = readEntity(
            'dataFields',
            edit.kind === 'addField' ? { ...edit, id: newId() } : { ...previous, ...edit.changes }
        );
        entity(document, field.entityId);
        uniqueName(
            Object.values(document.dataFields).filter((item) => item.entityId === field.entityId),
            field.name,
            field.id
        );

        return {
            id: field.id,
            write: () => {
                if (previous) {
                    Object.assign(previous, field);

                    return;
                }
                document.dataFields[field.id] = field;
            }
        };
    }
    if (edit.kind === 'deleteField') {
        if (!document.dataFields[edit.id]) {
            throw new Error('This field no longer exists.');
        }

        return {
            write: () => {
                delete document.dataFields[edit.id];
                Object.values(document.dataRecords).forEach(
                    (record) => delete record.values[edit.id]
                );
            }
        };
    }
    if (edit.kind === 'addRecord') {
        entity(document, edit.entityId);
        const last = dataRecords(document, edit.entityId).at(-1);
        const record = {
            id: newId(),
            entityId: edit.entityId,
            order: last ? last.order + 1 : 0,
            values: {}
        };

        return {
            id: record.id,
            write: () => {
                document.dataRecords[record.id] = record;
            }
        };
    }
    if (edit.kind === 'deleteRecord') {
        if (!document.dataRecords[edit.id]) {
            throw new Error('This record no longer exists.');
        }

        return {
            write: () => {
                delete document.dataRecords[edit.id];
            }
        };
    }
    if (edit.kind === 'removeLeftovers') {
        const leftovers = dataLeftovers(document);
        if (!leftovers.fields.length && !leftovers.records.length && !leftovers.values.length) {
            throw new Error('Nothing is left over.');
        }

        return {
            write: () => {
                leftovers.fields.forEach((id) => delete document.dataFields[id]);
                leftovers.records.forEach((id) => delete document.dataRecords[id]);
                leftovers.values.forEach(
                    ({ recordId, fieldId }) => delete document.dataRecords[recordId].values[fieldId]
                );
            }
        };
    }
    const record = document.dataRecords[edit.recordId];
    const field = document.dataFields[edit.fieldId];
    if (!record || !field || record.entityId !== field.entityId) {
        throw new Error('This record or field is no longer available.');
    }
    entity(document, record.entityId);
    const problem = dataValueProblem(field, edit.value);
    if (problem) {
        throw new Error(problem);
    }
    readEntity('dataRecords', { ...record, values: { ...record.values, [field.id]: edit.value } });

    return {
        write: () => {
            record.values[field.id] = edit.value;
        }
    };
}

export const editData: ActionWithParamAndResult<DataEdit, DataEditResult> = (
    { state, effects },
    edit
) => {
    const document = state.currentDocument;
    if (
        edit.documentId !== document.id ||
        document.locked ||
        isReadOnly(state) ||
        state.events.pointer.gesture.kind !== 'idle' ||
        state.resetDocumentId
    ) {
        return { applied: false, problem: 'Data editing is unavailable for this document.' };
    }
    try {
        const prepared = prepare(document, edit, effects.newId);
        effects.collaboration.startBatch(document.id, { kind: 'person' });
        prepared.write();
        effects.collaboration.flush();

        return { applied: true, id: prepared.id };
    } catch (error) {
        return {
            applied: false,
            problem: error instanceof Error ? error.message : 'Could not edit data.'
        };
    }
};
