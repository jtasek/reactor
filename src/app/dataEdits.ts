import type { ActionWithParamAndResult, Document } from './types';
import type { DataField, DataType, DataValue, DataList, DataRule } from './dataTypes';
import { isReadOnly } from './documentAccess';
import { readEntity, readDataList, readMapPosition } from './services/documentStorage';
import {
    dataLeftovers,
    dataRecords,
    dataRules,
    dataValueProblem,
    hasLeftovers,
    MAX_RECORDS_PER_ENTITY,
    ruleProblems
} from './data';
import { dataListProblems } from './dataLists';
import { isShapeLocked } from './utils';

export type DataChange =
    | { kind: 'setList'; instanceId: string; list: DataList | null }
    | { kind: 'addEntity'; name: string }
    | { kind: 'renameEntity'; id: string; name: string }
    | { kind: 'deleteEntity'; id: string }
    /** A null position hands the entity back to the map's own layout. */
    | { kind: 'moveEntity'; id: string; position: { x: number; y: number } | null }
    | { kind: 'arrangeEntities' }
    | { kind: 'setLabelField'; entityId: string; fieldId: string | null }
    | ({
          kind: 'addField';
          entityId: string;
          name: string;
          type: DataType;
          required: boolean;
      } & Pick<DataField, 'options' | 'targetEntityId'>)
    | {
          kind: 'updateField';
          id: string;
          changes: Partial<
              Pick<DataField, 'name' | 'type' | 'required' | 'options' | 'targetEntityId'>
          >;
      }
    | { kind: 'deleteField'; id: string }
    | { kind: 'addRecord'; entityId: string }
    | { kind: 'deleteRecord'; id: string }
    | { kind: 'setValue'; recordId: string; fieldId: string; value: DataValue }
    | { kind: 'addRule'; entityId: string; rule: RuleContent }
    | { kind: 'updateRule'; id: string; rule: RuleContent }
    | { kind: 'deleteRule'; id: string }
    | { kind: 'removeLeftovers' };
export type RuleContent = Pick<DataRule, 'when' | 'check' | 'message' | 'fieldId'>;

/** Per entity, like the record limit: enough for any prototype form. */
export const MAX_RULES_PER_ENTITY = 50;
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
    if (edit.kind === 'setLabelField') {
        entity(document, edit.entityId);
        const field = edit.fieldId === null ? undefined : document.dataFields[edit.fieldId];
        if (edit.fieldId !== null && (field?.entityId !== edit.entityId || field.type !== 'text')) {
            throw new Error('Records are named by one of their text fields.');
        }

        return {
            write: () => {
                if (edit.fieldId === null) {
                    delete document.dataEntities[edit.entityId].labelFieldId;

                    return;
                }
                document.dataEntities[edit.entityId].labelFieldId = edit.fieldId;
            }
        };
    }
    if (edit.kind === 'moveEntity') {
        entity(document, edit.id);
        const position = edit.position && readMapPosition(edit.position);

        return {
            write: () => {
                if (!position) {
                    delete document.dataEntities[edit.id].mapPosition;

                    return;
                }
                document.dataEntities[edit.id].mapPosition = position;
            }
        };
    }
    if (edit.kind === 'arrangeEntities') {
        const placed = Object.values(document.dataEntities).filter((item) => item.mapPosition);
        if (!placed.length) {
            throw new Error('The map already places every entity.');
        }

        return {
            write: () => placed.forEach((item) => delete item.mapPosition)
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
                Object.values(document.dataRules)
                    .filter((rule) => rule.entityId === edit.id)
                    .forEach((rule) => delete document.dataRules[rule.id]);
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
        const typeChanged =
            edit.kind === 'addField' ||
            'type' in edit.changes ||
            'options' in edit.changes ||
            'targetEntityId' in edit.changes;
        // Turning a field into a choice may leave options to add; saving none is refused.
        if (
            field.type === 'choice' &&
            !field.options?.length &&
            (edit.kind === 'addField' || 'options' in edit.changes)
        ) {
            throw new Error('Add at least one option.');
        }
        if (
            typeChanged &&
            field.type === 'reference' &&
            !document.dataEntities[field.targetEntityId ?? '']
        ) {
            throw new Error('Choose the entity this field refers to.');
        }
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
                const entity = document.dataEntities[document.dataFields[edit.id].entityId];
                if (entity?.labelFieldId === edit.id) {
                    delete entity.labelFieldId;
                }
                delete document.dataFields[edit.id];
                Object.values(document.dataRecords).forEach(
                    (record) => delete record.values[edit.id]
                );
            }
        };
    }
    if (edit.kind === 'addRule' || edit.kind === 'updateRule') {
        const previous = edit.kind === 'updateRule' ? document.dataRules[edit.id] : undefined;
        if (edit.kind === 'updateRule' && !previous) {
            throw new Error('This rule no longer exists.');
        }
        const entityId = previous?.entityId ?? (edit as { entityId: string }).entityId;
        entity(document, entityId);
        const existing = dataRules(document, entityId);
        if (!previous && existing.length >= MAX_RULES_PER_ENTITY) {
            throw new Error(`An entity has up to ${MAX_RULES_PER_ENTITY} rules.`);
        }
        const rule = readEntity('dataRules', {
            ...edit.rule,
            id: previous?.id ?? newId(),
            entityId,
            order: previous?.order ?? (existing.at(-1)?.order ?? -1) + 1
        });
        if (rule.fieldId && document.dataFields[rule.fieldId]?.entityId !== entityId) {
            throw new Error('Show the message at one of this entity’s fields.');
        }
        const problems = ruleProblems(document, rule);
        if (problems.length) {
            throw new Error(problems.join(' '));
        }

        return {
            id: rule.id,
            write: () => {
                document.dataRules[rule.id] = rule;
            }
        };
    }
    if (edit.kind === 'deleteRule') {
        if (!document.dataRules[edit.id]) {
            throw new Error('This rule no longer exists.');
        }

        return {
            write: () => {
                delete document.dataRules[edit.id];
            }
        };
    }
    if (edit.kind === 'addRecord') {
        entity(document, edit.entityId);
        const records = dataRecords(document, edit.entityId);
        if (records.length >= MAX_RECORDS_PER_ENTITY) {
            throw new Error(
                `An entity holds up to ${MAX_RECORDS_PER_ENTITY.toLocaleString('en-US')} sample records.`
            );
        }
        const last = records.at(-1);
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
        if (!hasLeftovers(leftovers)) {
            throw new Error('Nothing is left over.');
        }

        return {
            write: () => {
                leftovers.fields.forEach((id) => delete document.dataFields[id]);
                leftovers.records.forEach((id) => delete document.dataRecords[id]);
                leftovers.rules.forEach((id) => delete document.dataRules[id]);
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
    const problem = dataValueProblem(document, field, edit.value);
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
