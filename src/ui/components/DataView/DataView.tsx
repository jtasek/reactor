import React, { useEffect, useRef, useState } from 'react';
import { useActions, useAppState } from 'src/app/hooks';
import { isReadOnly } from 'src/app/documentAccess';
import {
    dataFields,
    dataLeftovers,
    dataProblems,
    dataRecords,
    dataValueProblem
} from 'src/app/data';
import { listsUsing } from 'src/app/dataLists';
import type { DataChange, DataEdit, DataEditResult } from 'src/app/dataEdits';
import type { DataType, DataValue } from 'src/app/dataTypes';
import styles from './styles.css';

const TYPES: DataType[] = ['text', 'number', 'boolean'];

/** Drafts stay local until Save; failed validation never writes a record. */
function ValueEditor({
    value,
    label,
    type = 'text',
    disabled,
    save
}: {
    value: DataValue | undefined;
    label: string;
    type?: DataType;
    disabled: boolean;
    save: (value: DataValue) => DataEditResult;
}) {
    const initial = value === null || value === undefined ? '' : String(value);
    const [draft, setDraft] = useState(initial);
    const [problem, setProblem] = useState('');
    const expected = type === 'text' ? 'string' : type;
    const needsConversion = value !== null && value !== undefined && typeof value !== expected;

    return (
        <form
            className={styles.valueEditor}
            onSubmit={(event) => {
                event.preventDefault();
                if (type === 'boolean' && !['', 'true', 'false'].includes(draft)) {
                    setProblem('Choose True, False or Not set.');

                    return;
                }
                const next =
                    type === 'text'
                        ? draft
                        : draft.trim() === ''
                          ? null
                          : type === 'number'
                            ? Number(draft)
                            : draft === 'true';
                const result = save(next);
                setProblem(result.applied ? '' : result.problem);
            }}
        >
            {type === 'boolean' ? (
                <select
                    aria-label={label}
                    value={draft}
                    disabled={disabled}
                    onChange={(event) => setDraft(event.target.value)}
                >
                    <option value="">Not set</option>
                    <option value="true">True</option>
                    <option value="false">False</option>
                    {draft !== '' && draft !== 'true' && draft !== 'false' && (
                        <option value={draft}>{draft} (invalid)</option>
                    )}
                </select>
            ) : (
                <input
                    aria-label={label}
                    value={draft}
                    disabled={disabled}
                    inputMode={type === 'number' ? 'decimal' : undefined}
                    onChange={(event) => setDraft(event.target.value)}
                />
            )}
            <button
                type="submit"
                disabled={disabled || (draft === initial && !needsConversion)}
                aria-label={`Save ${label}`}
            >
                Save
            </button>
            {problem && <small role="alert">{problem}</small>}
        </form>
    );
}

/** Shown beside the button that asked, so it is in view and has focus. */
function DeleteConfirmation({
    deletion,
    lists,
    disabled,
    cancel,
    confirm
}: {
    deletion: DataEdit;
    lists: number;
    disabled: boolean;
    cancel: () => void;
    confirm: () => void;
}) {
    const cancelButton = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        cancelButton.current?.focus();
        cancelButton.current?.scrollIntoView?.({ block: 'nearest' });
    }, []);

    return (
        <div role="alert" className={styles.confirmation}>
            <p>
                Delete this{' '}
                {deletion.kind === 'deleteEntity'
                    ? 'entity and its fields and records'
                    : 'field and its record values'}
                ? You can undo this change.
            </p>
            {lists > 0 && (
                <p>
                    {lists === 1 ? 'A data binding uses' : `${lists} data bindings use`} this{' '}
                    {deletion.kind === 'deleteEntity'
                        ? 'entity. Prototype will show component values instead.'
                        : 'field. Bound properties will show component values instead.'}
                </p>
            )}
            <button ref={cancelButton} type="button" onClick={cancel}>
                Cancel
            </button>
            <button type="button" disabled={disabled} onClick={confirm}>
                Delete
            </button>
        </div>
    );
}

export default function DataView() {
    const documentId = useAppState((state) => state.currentDocumentId);

    return <DataEditor key={documentId} />;
}

function DataEditor() {
    const actions = useActions();
    const [selectedId, setSelectedId] = useState('');
    const [name, setName] = useState('');
    const [fieldName, setFieldName] = useState('');
    const [type, setType] = useState<DataType>('text');
    const [required, setRequired] = useState(false);
    const [message, setMessage] = useState('');
    const [deletion, setDeletion] = useState<DataEdit>();
    const data = useAppState((state) => {
        const document = state.currentDocument;
        const entities = Object.values(document.dataEntities)
            .map((item) => ({ ...item }))
            .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
        const entity = entities.find((item) => item.id === selectedId) ?? entities[0];
        const fields = dataFields(document, entity?.id ?? '').map((field) => ({ ...field }));
        const records = dataRecords(document, entity?.id ?? '').map((record) => ({
            ...record,
            values: { ...record.values }
        }));
        const leftovers = dataLeftovers(document);
        const target =
            deletion && 'id' in deletion
                ? deletion.kind === 'deleteEntity'
                    ? { entityId: deletion.id }
                    : deletion.kind === 'deleteField'
                      ? { fieldId: deletion.id }
                      : undefined
                : undefined;

        return {
            documentId: document.id,
            entities,
            entity,
            fields,
            records,
            problems: dataProblems(document),
            listsUsingDeletion: target ? listsUsing(document, target) : 0,
            hasLeftovers:
                leftovers.fields.length + leftovers.records.length + leftovers.values.length > 0,
            disabled:
                document.locked ||
                isReadOnly(state) ||
                state.events.pointer.gesture.kind !== 'idle' ||
                Boolean(state.resetDocumentId)
        };
    });
    const entityId = data.entity?.id ?? '';
    useEffect(() => {
        if (selectedId !== entityId) {
            setSelectedId(entityId);
        }
    }, [entityId, selectedId]);

    const edit = (input: DataChange): DataEditResult => {
        const result = actions.editData({ ...input, documentId: data.documentId });
        setMessage(result.applied ? '' : result.problem);

        return result;
    };
    const confirmation = (kind: DataEdit['kind'], id: string) =>
        deletion?.kind === kind &&
        'id' in deletion &&
        deletion.id === id && (
            <DeleteConfirmation
                deletion={deletion}
                lists={data.listsUsingDeletion}
                disabled={data.disabled}
                cancel={() => setDeletion(undefined)}
                confirm={() => {
                    if (edit(deletion).applied) {
                        setDeletion(undefined);
                    }
                }}
            />
        );

    return (
        <section className={styles.dataView} aria-label="Data View">
            <p>
                Define your data, then add sample records. To repeat a component over records,
                select an instance and use Inspector → Repeat with data.
            </p>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    const result = edit({ kind: 'addEntity', name });
                    if (result.applied) {
                        setSelectedId(result.id!);
                        setName('');
                    }
                }}
            >
                <label>
                    New entity
                    <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        disabled={data.disabled}
                        placeholder="Customers"
                    />
                </label>
                <button disabled={data.disabled || !name.trim()}>Add entity</button>
            </form>
            {data.entities.length === 0 ? (
                <p>No entities yet. Add one to define fields and sample records.</p>
            ) : (
                <>
                    <label>
                        Entity
                        <select
                            value={data.entity?.id}
                            onChange={(event) => {
                                setSelectedId(event.target.value);
                                setDeletion(undefined);
                            }}
                        >
                            {data.entities.map((entity) => (
                                <option key={entity.id} value={entity.id}>
                                    {entity.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    {data.entity && (
                        <>
                            <ValueEditor
                                key={`${data.entity.id}:${data.entity.name}`}
                                label="Entity name"
                                value={data.entity.name}
                                disabled={data.disabled}
                                save={(name) =>
                                    edit({
                                        kind: 'renameEntity',
                                        id: data.entity!.id,
                                        name: String(name)
                                    })
                                }
                            />
                            <button
                                disabled={data.disabled}
                                onClick={() =>
                                    setDeletion({
                                        kind: 'deleteEntity',
                                        id: data.entity!.id,
                                        documentId: data.documentId
                                    })
                                }
                            >
                                Delete entity…
                            </button>
                            {confirmation('deleteEntity', data.entity.id)}
                            <h3>Fields</h3>
                            <form
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    const result = edit({
                                        kind: 'addField',
                                        entityId: data.entity!.id,
                                        name: fieldName,
                                        type,
                                        required
                                    });
                                    if (result.applied) {
                                        setFieldName('');
                                    }
                                }}
                            >
                                <label>
                                    Field name
                                    <input
                                        value={fieldName}
                                        disabled={data.disabled}
                                        onChange={(event) => setFieldName(event.target.value)}
                                        placeholder="Name"
                                    />
                                </label>
                                <label>
                                    Field type
                                    <select
                                        value={type}
                                        disabled={data.disabled}
                                        onChange={(event) =>
                                            setType(event.target.value as DataType)
                                        }
                                    >
                                        {TYPES.map((type) => (
                                            <option key={type}>{type}</option>
                                        ))}
                                    </select>
                                </label>
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={required}
                                        disabled={data.disabled}
                                        onChange={(event) => setRequired(event.target.checked)}
                                    />
                                    Required
                                </label>
                                <button disabled={data.disabled || !fieldName.trim()}>
                                    Add field
                                </button>
                            </form>
                            {!data.fields.length && (
                                <p>No fields yet. Add a field before entering record values.</p>
                            )}
                            {data.fields.map((field) => (
                                <div className={styles.field} key={field.id}>
                                    <ValueEditor
                                        key={field.name}
                                        label={`Field ${field.name}`}
                                        value={field.name}
                                        disabled={data.disabled}
                                        save={(name) =>
                                            edit({
                                                kind: 'updateField',
                                                id: field.id,
                                                changes: { name: String(name) }
                                            })
                                        }
                                    />
                                    <label>
                                        Type for {field.name}
                                        <select
                                            value={field.type}
                                            disabled={data.disabled}
                                            onChange={(event) =>
                                                edit({
                                                    kind: 'updateField',
                                                    id: field.id,
                                                    changes: {
                                                        type: event.target.value as DataType
                                                    }
                                                })
                                            }
                                        >
                                            {TYPES.map((type) => (
                                                <option key={type}>{type}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            aria-label={`Require ${field.name}`}
                                            checked={field.required}
                                            disabled={data.disabled}
                                            onChange={(event) =>
                                                edit({
                                                    kind: 'updateField',
                                                    id: field.id,
                                                    changes: { required: event.target.checked }
                                                })
                                            }
                                        />
                                        Required
                                    </label>
                                    <button
                                        disabled={data.disabled}
                                        onClick={() =>
                                            setDeletion({
                                                kind: 'deleteField',
                                                id: field.id,
                                                documentId: data.documentId
                                            })
                                        }
                                    >
                                        Delete {field.name}…
                                    </button>
                                    {confirmation('deleteField', field.id)}
                                </div>
                            ))}
                            <h3>Sample records</h3>
                            <button
                                disabled={data.disabled || !data.fields.length}
                                onClick={() =>
                                    edit({ kind: 'addRecord', entityId: data.entity!.id })
                                }
                            >
                                Add record
                            </button>
                            {!data.records.length && <p>No sample records yet.</p>}
                            <div className={styles.records}>
                                <table>
                                    <caption>{data.entity.name} sample records</caption>
                                    <thead>
                                        <tr>
                                            <th>Record</th>
                                            {data.fields.map((field) => (
                                                <th key={field.id}>
                                                    {field.name}
                                                    {field.required ? ' *' : ''}
                                                </th>
                                            ))}
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.records.map((record, index) => (
                                            <tr key={record.id}>
                                                <th title={record.id}>{index + 1}</th>
                                                {data.fields.map((field) => (
                                                    <td key={field.id}>
                                                        <ValueEditor
                                                            key={`${field.type}:${JSON.stringify(record.values[field.id])}`}
                                                            value={record.values[field.id]}
                                                            type={field.type}
                                                            label={`${field.name}, record ${index + 1}`}
                                                            disabled={data.disabled}
                                                            save={(value) =>
                                                                edit({
                                                                    kind: 'setValue',
                                                                    recordId: record.id,
                                                                    fieldId: field.id,
                                                                    value
                                                                })
                                                            }
                                                        />
                                                        <small>
                                                            {dataValueProblem(
                                                                field,
                                                                record.values[field.id]
                                                            )}
                                                        </small>
                                                    </td>
                                                ))}
                                                <td>
                                                    <button
                                                        disabled={data.disabled}
                                                        onClick={() =>
                                                            edit({
                                                                kind: 'deleteRecord',
                                                                id: record.id
                                                            })
                                                        }
                                                    >
                                                        Delete record {index + 1}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </>
            )}
            {message && <p role="status">{message}</p>}
            {data.problems.length > 0 && (
                <section aria-label="Data diagnostics">
                    <h3>Needs attention ({data.problems.length})</h3>
                    <ul>
                        {data.problems.slice(0, 20).map((problem, index) => (
                            <li key={index}>{problem}</li>
                        ))}
                    </ul>
                    {data.hasLeftovers && (
                        <button
                            disabled={data.disabled}
                            onClick={() => edit({ kind: 'removeLeftovers' })}
                        >
                            Remove leftovers
                        </button>
                    )}
                </section>
            )}
        </section>
    );
}
