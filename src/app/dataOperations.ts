import type { Document, InstanceShape } from './types';
import type { DataEntity, DataField, DataList, DataRecord } from './dataTypes';
import type { NewDataRecord, Operation } from './operations';
import {
    breaksRule,
    dataFields,
    dataValueProblem,
    MAX_RECORDS_PER_ENTITY,
    runnableRules
} from './data';
import { dataListProblems } from './dataLists';
import { readEntity } from './services/documentStorage';

type DataView = Pick<Document, 'dataEntities' | 'dataFields' | 'dataRecords' | 'dataRules'>;

export interface StagedData {
    dataEntities: DataEntity[];
    dataFields: DataField[];
    dataRecords: DataRecord[];
}

interface Declared {
    index: number;
    id: string;
}

/**
 * What a batch's `addEntity` and `addRecords` operations add, each record checked against its
 * fields and its entity's rules as forms check it. Entity and record keys are the batch's, as
 * `taken` reports the others; field keys belong to their entity. Throws `fail(index, error)`.
 */
export function stageData(
    document: Document,
    operations: Operation[],
    newId: () => string,
    taken: (key: string) => boolean,
    fail: (index: number, error: unknown) => Error
) {
    const entities = new Map<string, Declared & { fields: Map<string, string> }>();
    const records = new Map<string, Declared>();
    const ids = new Map<string, string>();
    const staged: StagedData = { dataEntities: [], dataFields: [], dataRecords: [] };
    const view: DataView = {
        dataEntities: { ...document.dataEntities },
        dataFields: { ...document.dataFields },
        dataRecords: { ...document.dataRecords },
        dataRules: document.dataRules
    };

    const declare = (key: string) => {
        if (
            taken(key) ||
            ids.has(key) ||
            Object.hasOwn(document.dataEntities, key) ||
            Object.hasOwn(document.dataRecords, key)
        ) {
            throw new Error(`the key ${key} is taken.`);
        }
        const id = newId();
        ids.set(key, id);

        return id;
    };
    operations.forEach((operation, index) => {
        try {
            if (
                document.locked &&
                (operation.op === 'addEntity' || operation.op === 'addRecords')
            ) {
                throw new Error('The document is locked.');
            }
            if (operation.op === 'addEntity') {
                entities.set(operation.key, {
                    index,
                    id: declare(operation.key),
                    fields: new Map()
                });
            }
            if (operation.op === 'addEntity' || operation.op === 'addRecords') {
                operation.records?.forEach(({ key }) => {
                    if (key !== undefined) {
                        records.set(key, { index, id: declare(key) });
                    }
                });
            }
        } catch (error) {
            throw fail(index, error);
        }
    });

    /** An entity ID, or the key of an entity an earlier operation adds, or this one with `own`. */
    const entityId = (ref: string, index: number, own = false) => {
        const entry = entities.get(ref);
        if (entry) {
            if (entry.index > index || (entry.index === index && !own)) {
                throw new Error(`${ref} is not one of the batch's earlier entities.`);
            }

            return entry.id;
        }
        if (!Object.hasOwn(view.dataEntities, ref)) {
            throw new Error(`${ref} is not an entity of the document.`);
        }

        return ref;
    };
    /** A field of the entity by ID, or by key when the batch adds the entity. */
    const field = (entity: string, ref: string) => {
        const id = [...entities.values()].find((entry) => entry.id === entity)?.fields.get(ref);
        const found = view.dataFields[id ?? ref];
        if (found?.entityId !== entity) {
            throw new Error(`${ref} is not a field of ${view.dataEntities[entity].name}.`);
        }

        return found;
    };
    const uniqueName = (names: string[], name: string, what: string) => {
        if (names.includes(name)) {
            throw new Error(`${what} ${name} is taken.`);
        }
    };

    const addRecords = (entity: string, inputs: NewDataRecord[], index: number) => {
        const existing = Object.values(view.dataRecords).filter(
            (record) => record.entityId === entity
        );
        const { name } = view.dataEntities[entity];
        if (inputs.length === 0) {
            throw new Error('it adds no records.');
        }
        if (existing.length + inputs.length > MAX_RECORDS_PER_ENTITY) {
            throw new Error(
                `${name} would have ${existing.length + inputs.length} records; entities hold up to ${MAX_RECORDS_PER_ENTITY.toLocaleString('en-US')}.`
            );
        }
        let order = Math.max(-1, ...existing.map((record) => record.order));
        // Every record exists before values are read, so records may refer to each other.
        const added = inputs.map(({ key }) => {
            const record: DataRecord = {
                id: key === undefined ? newId() : records.get(key)!.id,
                entityId: entity,
                order: ++order,
                values: {}
            };
            view.dataRecords[record.id] = record;

            return record;
        });
        const fields = dataFields(view as Document, entity);
        const rules = runnableRules(view as Document, entity);
        added.forEach((record, row) => {
            const at = `Record ${row + 1} of ${name}:`;
            try {
                Object.entries(inputs[row].values).forEach(([ref, value]) => {
                    const target = field(entity, ref);
                    const key =
                        target.type === 'reference' && typeof value === 'string'
                            ? records.get(value)
                            : undefined;
                    if (key && key.index > index) {
                        throw new Error(`${value} is a record a later operation adds.`);
                    }
                    record.values[target.id] = key ? key.id : value;
                });
                const read = readEntity('dataRecords', record);
                for (const each of fields) {
                    const problem = dataValueProblem(view, each, read.values[each.id]);
                    if (problem) {
                        throw new Error(problem);
                    }
                }
                const broken = rules.find((rule) => breaksRule(rule, read.values));
                if (broken) {
                    throw new Error(broken.message);
                }
                view.dataRecords[read.id] = read;
                staged.dataRecords.push(read);
            } catch (error) {
                throw new Error(`${at} ${error instanceof Error ? error.message : String(error)}`, {
                    cause: error
                });
            }
        });
    };

    operations.forEach((operation, index) => {
        try {
            if (operation.op === 'addRecords') {
                addRecords(entityId(operation.entity, index), operation.records, index);
            }
            if (operation.op !== 'addEntity') {
                return;
            }
            const declared = entities.get(operation.key)!;
            const entity: DataEntity = readEntity('dataEntities', {
                id: declared.id,
                name: operation.name
            });
            uniqueName(
                Object.values(view.dataEntities).map((each) => each.name),
                entity.name,
                'the entity name'
            );
            if (operation.fields.length === 0) {
                throw new Error('an entity needs at least one field.');
            }
            view.dataEntities[entity.id] = entity;
            const names: string[] = [];
            operation.fields.forEach(({ key, targetEntity, ...input }) => {
                if (declared.fields.has(key)) {
                    throw new Error(`the field key ${key} is used twice.`);
                }
                const added = readEntity('dataFields', {
                    ...input,
                    required: input.required ?? false,
                    id: newId(),
                    entityId: entity.id,
                    ...(targetEntity === undefined
                        ? {}
                        : { targetEntityId: entityId(targetEntity, index, true) })
                });
                uniqueName(names, added.name, 'the field name');
                if (added.type === 'choice' && !added.options?.length) {
                    throw new Error(`the choice field ${added.name} needs options.`);
                }
                if (added.type === 'reference' && !added.targetEntityId) {
                    throw new Error(`the reference field ${added.name} needs targetEntity.`);
                }
                names.push(added.name);
                declared.fields.set(key, added.id);
                view.dataFields[added.id] = added;
                staged.dataFields.push(added);
            });
            if (operation.labelField !== undefined) {
                const label = field(entity.id, operation.labelField);
                if (label.type !== 'text') {
                    throw new Error('records are named by a text field.');
                }
                entity.labelFieldId = label.id;
            }
            staged.dataEntities.push(entity);
            if (operation.records) {
                addRecords(entity.id, operation.records, index);
            }
        } catch (error) {
            throw fail(index, error);
        }
    });

    return {
        staged,
        ids,
        /**
         * Resolves a list's entity and field references written as batch keys, then checks it
         * against the instance's component, as Inspector does.
         */
        linkList(
            document: Document,
            components: Document['components'],
            instance: InstanceShape,
            list: DataList,
            index: number
        ): DataList {
            const entity = entityId(list.entityId, index);
            const linked = {
                ...list,
                entityId: entity,
                fields: Object.fromEntries(
                    Object.entries(list.fields).map(([prop, ref]) => [prop, field(entity, ref).id])
                )
            };
            const problems = dataListProblems(
                Object.assign(Object.create(document) as Document, view, { components }),
                { ...instance, dataList: linked },
                linked
            );
            if (problems.length) {
                throw new Error(problems.join(' '));
            }

            return linked;
        }
    };
}

/** Writes what `stageData` staged. */
export function writeData(document: Document, staged: StagedData) {
    staged.dataEntities.forEach((entity) => {
        document.dataEntities[entity.id] = entity;
    });
    staged.dataFields.forEach((field) => {
        document.dataFields[field.id] = field;
    });
    staged.dataRecords.forEach((record) => {
        document.dataRecords[record.id] = record;
    });
}
