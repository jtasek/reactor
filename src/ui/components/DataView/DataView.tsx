import React, { useEffect, useId, useRef, useState } from 'react';
import {
    Check,
    Database,
    Hash,
    Link2,
    List,
    Plus,
    Table2,
    ToggleLeft,
    Trash2,
    TriangleAlert,
    Type
} from 'lucide-react';
import { useActions, useAppState } from 'src/app/hooks';
import { isReadOnly } from 'src/app/documentAccess';
import {
    dataFields,
    dataLeftovers,
    dataProblems,
    dataRecords,
    dataRules,
    dataValueProblem,
    fieldChoices,
    hasLeftovers,
    labelField,
    MAX_RECORDS_PER_ENTITY,
    breaksRule,
    ruleProblems,
    ruleTarget
} from 'src/app/data';
import { DataRules } from './DataRules';
import { conditionFields } from 'src/app/expressions';
import { listsUsing } from 'src/app/dataLists';
import type { DataChange, DataEdit, DataEditResult } from 'src/app/dataEdits';
import type { DataRule, DataType, DataValue } from 'src/app/dataTypes';
import styles from './styles.css';

const TYPES: DataType[] = ['text', 'number', 'boolean', 'choice', 'reference'];

/**
 * A reference column offers every record of its target, and an entity has up to 1,000 rows, so
 * a long list of choices is only drawn into a cell once that cell is used.
 */
const DRAWN_CHOICES = 100;

type Choice = { value: string; label: string };

const TABS = ['records', 'fields', 'rules'] as const;
type Tab = (typeof TABS)[number];
const TAB_NAMES: Record<Tab, string> = { records: 'Records', fields: 'Fields', rules: 'Rules' };

/** Needs attention lists this many problems; the count above it says how many there are. */
const MAX_LISTED_PROBLEMS = 20;

const TYPE_ICONS = {
    text: Type,
    number: Hash,
    boolean: ToggleLeft,
    choice: List,
    reference: Link2
};

const TypeIcon = ({ type }: { type: DataType }) => {
    const Icon = TYPE_ICONS[type];

    return (
        <span className={styles.typeIcon} data-type={type} title={type}>
            <Icon aria-hidden size={12} strokeWidth={2.25} />
        </span>
    );
};

/** One option per line; blank lines are ignored, the rest checked when saved. */
const optionLines = (draft: string) =>
    draft
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

/** Drafts stay local until saved with Enter or the check button; Escape puts the value back. */
function ValueEditor({
    value,
    label,
    type = 'text',
    choices,
    disabled,
    variant = 'cell',
    save
}: {
    value: DataValue | undefined;
    label: string;
    type?: DataType;
    /** Choice options or referenced records; a value no longer offered stays, marked. */
    choices?: Choice[];
    disabled: boolean;
    variant?: 'cell' | 'title' | 'name';
    save: (value: DataValue) => DataEditResult;
}) {
    const initial = value === null || value === undefined ? '' : String(value);
    const [draft, setDraft] = useState(initial);
    const [problem, setProblem] = useState('');
    const [used, setUsed] = useState(false);
    const expected = type === 'number' || type === 'boolean' ? type : 'string';
    const offered =
        choices && (used || choices.length <= DRAWN_CHOICES)
            ? choices
            : choices?.filter((choice) => choice.value === draft);
    const needsConversion = value !== null && value !== undefined && typeof value !== expected;
    const changed = draft !== initial || needsConversion;
    const revert = (event: React.KeyboardEvent) => {
        if (event.key === 'Escape' && changed) {
            event.preventDefault();
            event.stopPropagation();
            setDraft(initial);
            setProblem('');
        }
    };

    return (
        <form
            className={styles.valueEditor}
            data-variant={variant}
            data-changed={changed || undefined}
            data-problem={problem ? true : undefined}
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
                            : type === 'boolean'
                              ? draft === 'true'
                              : draft;
                const result = save(next);
                setProblem(result.applied ? '' : result.problem);
            }}
        >
            {type === 'boolean' ? (
                <select
                    aria-label={label}
                    value={draft}
                    disabled={disabled}
                    onKeyDown={revert}
                    onChange={(event) => setDraft(event.target.value)}
                >
                    <option value="">Not set</option>
                    <option value="true">True</option>
                    <option value="false">False</option>
                    {draft !== '' && draft !== 'true' && draft !== 'false' && (
                        <option value={draft}>{draft} (invalid)</option>
                    )}
                </select>
            ) : choices && offered ? (
                <select
                    aria-label={label}
                    value={draft}
                    disabled={disabled}
                    onKeyDown={revert}
                    onFocus={() => setUsed(true)}
                    onPointerDown={() => setUsed(true)}
                    onChange={(event) => setDraft(event.target.value)}
                >
                    <option value="">Not set</option>
                    {offered.map((choice) => (
                        <option key={choice.value} value={choice.value}>
                            {choice.label}
                        </option>
                    ))}
                    {draft !== '' && !choices.some((choice) => choice.value === draft) && (
                        <option value={draft}>{draft} (unavailable)</option>
                    )}
                </select>
            ) : (
                <input
                    aria-label={label}
                    value={draft}
                    disabled={disabled}
                    onKeyDown={revert}
                    placeholder={variant === 'cell' ? '—' : undefined}
                    inputMode={type === 'number' ? 'decimal' : undefined}
                    onChange={(event) => setDraft(event.target.value)}
                />
            )}
            {changed && (
                <button
                    type="submit"
                    className={styles.save}
                    disabled={disabled}
                    aria-label={`Save ${label}`}
                    title="Save (Enter) · Escape to undo"
                >
                    <Check aria-hidden size={14} strokeWidth={2.5} />
                </button>
            )}
            {problem && <small role="alert">{problem}</small>}
        </form>
    );
}

/** Shown beside the button that asked, so it is in view and has focus. */
function DeleteConfirmation({
    deletion,
    lists,
    references,
    rules,
    disabled,
    cancel,
    confirm
}: {
    deletion: DataEdit;
    lists: number;
    /** Rules that use the field being deleted; they stop running until edited. */
    rules: number;
    /** Reference fields in other entities that point at the entity being deleted. */
    references: number;
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
            {references > 0 && (
                <p>
                    {references === 1
                        ? 'A reference field refers'
                        : `${references} reference fields refer`}{' '}
                    to this entity. Their values will need new records.
                </p>
            )}
            {rules > 0 && (
                <p>
                    {rules === 1 ? 'A rule uses' : `${rules} rules use`} this field.{' '}
                    {rules === 1 ? 'It stops' : 'They stop'} checking records until edited.
                </p>
            )}
            <button ref={cancelButton} type="button" onClick={cancel}>
                Cancel
            </button>
            <button
                type="button"
                className={styles.destructive}
                disabled={disabled}
                onClick={confirm}
            >
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
    const [options, setOptions] = useState('');
    const [target, setTarget] = useState('');
    const [message, setMessage] = useState('');
    const [deletion, setDeletion] = useState<DataEdit>();
    const [tab, setTab] = useState<Tab>('records');
    const tabsId = useId();
    const tabList = useRef<HTMLDivElement>(null);
    const newEntity = useRef<HTMLInputElement>(null);
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
        const choices = Object.fromEntries(
            fields
                .filter((field) => field.type === 'choice' || field.type === 'reference')
                .map((field) => [field.id, fieldChoices(document, field)])
        );
        // Overmind state is proxied, which structuredClone refuses.
        const rules = dataRules(document, entity?.id ?? '').map(
            (rule): DataRule => JSON.parse(JSON.stringify(rule))
        );
        const brokenRules = Object.fromEntries(
            rules.map((rule) => [rule.id, ruleProblems(document, rule)])
        );
        const runnable = rules.filter((rule) => !brokenRules[rule.id].length);
        // A cell shows its value's problem, else the first rule the record breaks there.
        const cellProblems = Object.fromEntries(
            records.map((record) => {
                const problems: Record<string, string> = {};
                for (const field of fields) {
                    const problem = dataValueProblem(document, field, record.values[field.id]);
                    if (problem) {
                        problems[field.id] = problem;
                    }
                }
                for (const rule of runnable) {
                    const target = ruleTarget(document, rule);
                    if (!problems[target] && breaksRule(rule, record.values)) {
                        problems[target] = rule.message;
                    }
                }

                return [record.id, problems];
            })
        );
        const leftovers = dataLeftovers(document);
        const target =
            deletion && 'id' in deletion
                ? deletion.kind === 'deleteEntity'
                    ? { entityId: deletion.id }
                    : deletion.kind === 'deleteField'
                      ? { fieldId: deletion.id }
                      : undefined
                : undefined;

        const recordCounts: Record<string, number> = {};
        for (const record of Object.values(document.dataRecords)) {
            recordCounts[record.entityId] = (recordCounts[record.entityId] ?? 0) + 1;
        }
        const fieldCounts: Record<string, number> = {};
        for (const field of Object.values(document.dataFields)) {
            fieldCounts[field.entityId] = (fieldCounts[field.entityId] ?? 0) + 1;
        }

        return {
            documentId: document.id,
            entities,
            recordCounts,
            fieldCounts,
            entity,
            fields,
            records,
            rules,
            brokenRules,
            problems: dataProblems(document),
            choices,
            cellProblems,
            label: entity && labelField(document, entity.id)?.id,
            listsUsingDeletion: target ? listsUsing(document, target) : 0,
            rulesUsingDeletion:
                deletion?.kind === 'deleteField'
                    ? Object.values(document.dataRules).filter((rule) =>
                          [rule.when, rule.check].some(
                              (condition) =>
                                  condition && conditionFields(condition).includes(deletion.id)
                          )
                      ).length
                    : 0,
            referencesToDeletion:
                deletion?.kind === 'deleteEntity'
                    ? Object.values(document.dataFields).filter(
                          (field) =>
                              field.type === 'reference' &&
                              field.targetEntityId === deletion.id &&
                              field.entityId !== deletion.id
                      ).length
                    : 0,
            hasLeftovers: hasLeftovers(leftovers),
            disabled:
                document.locked ||
                isReadOnly(state) ||
                state.events.pointer.gesture.kind !== 'idle' ||
                Boolean(state.resetDocumentId)
        };
    });
    const entityId = data.entity?.id ?? '';
    // The entity chosen for a new reference field may have been deleted since.
    const addTarget = data.entities.some((entity) => entity.id === target)
        ? target
        : data.entities[0]?.id;
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
                references={data.referencesToDeletion}
                rules={data.rulesUsingDeletion}
                disabled={data.disabled}
                cancel={() => setDeletion(undefined)}
                confirm={() => {
                    if (edit(deletion).applied) {
                        setDeletion(undefined);
                    }
                }}
            />
        );

    const entity = data.entity;
    const tabCounts: Record<Tab, number> = {
        records: data.records.length,
        fields: data.fields.length,
        rules: data.rules.length
    };
    // The field that names records leads the table, the rest follow by name.
    const columns = [
        ...data.fields.filter((field) => field.id === data.label),
        ...data.fields.filter((field) => field.id !== data.label)
    ];
    const notices = (
        <>
            {message && (
                <p role="status" className={styles.message}>
                    {message}
                </p>
            )}
            {data.problems.length > 0 && (
                <section aria-label="Data diagnostics" className={styles.attention}>
                    <details>
                        <summary>
                            <TriangleAlert aria-hidden size={14} />
                            Needs attention ({data.problems.length})
                        </summary>
                        <ul>
                            {data.problems.slice(0, MAX_LISTED_PROBLEMS).map((problem, index) => (
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
                    </details>
                </section>
            )}
        </>
    );
    const records = entity && (
        <>
            {data.records.length >= MAX_RECORDS_PER_ENTITY && (
                <p className={styles.hint}>
                    An entity holds up to {MAX_RECORDS_PER_ENTITY.toLocaleString('en-US')} sample
                    records.
                </p>
            )}
            {!data.fields.length ? (
                <div className={styles.emptyState}>
                    <p>No fields yet. Add a field before entering record values.</p>
                    <button type="button" onClick={() => setTab('fields')}>
                        Go to Fields
                    </button>
                </div>
            ) : (
                <div className={styles.records}>
                    <table>
                        <caption className={styles.visuallyHidden}>
                            {entity.name} sample records
                        </caption>
                        <thead>
                            <tr>
                                <th scope="col" className={styles.rowNumber}>
                                    <span className={styles.visuallyHidden}>Record</span>
                                </th>
                                {columns.map((field) => (
                                    <th key={field.id} scope="col">
                                        <span className={styles.columnName}>
                                            <TypeIcon type={field.type} />
                                            {field.name}
                                            {field.required && (
                                                <abbr title="Required" className={styles.required}>
                                                    {' *'}
                                                </abbr>
                                            )}
                                        </span>
                                    </th>
                                ))}
                                <th scope="col" className={styles.rowActions}>
                                    <span className={styles.visuallyHidden}>Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.records.map((record, index) => (
                                <tr key={record.id}>
                                    <th
                                        scope="row"
                                        title={record.id}
                                        className={styles.rowNumber}
                                        data-problem={
                                            data.cellProblems[record.id]?.record ? true : undefined
                                        }
                                    >
                                        {index + 1}
                                        {data.cellProblems[record.id]?.record && (
                                            <small>{data.cellProblems[record.id].record}</small>
                                        )}
                                    </th>
                                    {columns.map((field) => (
                                        <td
                                            key={field.id}
                                            data-problem={
                                                data.cellProblems[record.id]?.[field.id]
                                                    ? true
                                                    : undefined
                                            }
                                        >
                                            <ValueEditor
                                                key={`${field.type}:${JSON.stringify(record.values[field.id])}`}
                                                value={record.values[field.id]}
                                                type={field.type}
                                                choices={data.choices[field.id]}
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
                                                {data.cellProblems[record.id]?.[field.id]}
                                            </small>
                                        </td>
                                    ))}
                                    <td className={styles.rowActions}>
                                        <button
                                            className={styles.iconButton}
                                            aria-label={`Delete record ${index + 1}`}
                                            title={`Delete record ${index + 1}`}
                                            disabled={data.disabled}
                                            onClick={() =>
                                                edit({ kind: 'deleteRecord', id: record.id })
                                            }
                                        >
                                            <Trash2 aria-hidden size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {!data.records.length && (
                        <p className={styles.tableEmpty}>
                            No sample records yet. Use Add record, then type values into the cells;
                            Enter saves.
                        </p>
                    )}
                </div>
            )}
            <p className={styles.hint}>
                To repeat a component over these records, select an instance and use Inspector →
                Repeat with data.
            </p>
        </>
    );
    const fieldsPanel = entity && (
        <>
            <form
                className={styles.newField}
                aria-label="New field"
                onSubmit={(event) => {
                    event.preventDefault();
                    const result = edit({
                        kind: 'addField',
                        entityId: entity.id,
                        name: fieldName,
                        type,
                        required,
                        ...(type === 'choice' && { options: optionLines(options) }),
                        ...(type === 'reference' && { targetEntityId: addTarget })
                    });
                    if (result.applied) {
                        setFieldName('');
                        setOptions('');
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
                        onChange={(event) => setType(event.target.value as DataType)}
                    >
                        {TYPES.map((type) => (
                            <option key={type} value={type}>
                                {type}
                            </option>
                        ))}
                    </select>
                </label>
                {type === 'choice' && (
                    <label className={styles.wide}>
                        Options, one per line
                        <textarea
                            value={options}
                            disabled={data.disabled}
                            rows={3}
                            onChange={(event) => setOptions(event.target.value)}
                            placeholder={'Active\nPaused'}
                        />
                    </label>
                )}
                {type === 'reference' && (
                    <EntitySelect
                        label="Refers to"
                        entities={data.entities}
                        value={addTarget}
                        disabled={data.disabled}
                        change={setTarget}
                    />
                )}
                <label className={styles.toggle}>
                    <input
                        type="checkbox"
                        role="switch"
                        checked={required}
                        disabled={data.disabled}
                        onChange={(event) => setRequired(event.target.checked)}
                    />
                    Required
                </label>
                <button className={styles.primary} disabled={data.disabled || !fieldName.trim()}>
                    <Plus aria-hidden size={14} strokeWidth={2.25} />
                    Add field
                </button>
            </form>
            {data.fields.length > 0 && (
                <ul className={styles.group} aria-label="Fields">
                    {data.fields.map((field) => (
                        <li className={styles.field} key={field.id}>
                            <div className={styles.fieldLine}>
                                <TypeIcon type={field.type} />
                                <ValueEditor
                                    key={field.name}
                                    variant="name"
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
                                {field.id === data.label && (
                                    <span className={styles.badge} title="Names records">
                                        Record name
                                    </span>
                                )}
                                <select
                                    className={styles.typeSelect}
                                    aria-label={`Type for ${field.name}`}
                                    value={field.type}
                                    disabled={data.disabled}
                                    onChange={(event) =>
                                        edit({
                                            kind: 'updateField',
                                            id: field.id,
                                            changes: { type: event.target.value as DataType }
                                        })
                                    }
                                >
                                    {TYPES.map((type) => (
                                        <option key={type} value={type}>
                                            {type}
                                        </option>
                                    ))}
                                </select>
                                <label className={styles.toggle}>
                                    <input
                                        type="checkbox"
                                        role="switch"
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
                                    className={styles.iconButton}
                                    aria-label={`Delete ${field.name}…`}
                                    title={`Delete ${field.name}…`}
                                    disabled={data.disabled}
                                    onClick={() =>
                                        setDeletion({
                                            kind: 'deleteField',
                                            id: field.id,
                                            documentId: data.documentId
                                        })
                                    }
                                >
                                    <Trash2 aria-hidden size={14} />
                                </button>
                            </div>
                            {field.type === 'choice' && (
                                <OptionsEditor
                                    key={JSON.stringify(field.options ?? [])}
                                    label={`Options for ${field.name}`}
                                    options={field.options ?? []}
                                    disabled={data.disabled}
                                    save={(options) =>
                                        edit({
                                            kind: 'updateField',
                                            id: field.id,
                                            changes: { options }
                                        })
                                    }
                                />
                            )}
                            {field.type === 'reference' && (
                                <div className={styles.fieldDetail}>
                                    <EntitySelect
                                        label={`${field.name} refers to`}
                                        entities={data.entities}
                                        value={field.targetEntityId}
                                        disabled={data.disabled}
                                        change={(targetEntityId) =>
                                            edit({
                                                kind: 'updateField',
                                                id: field.id,
                                                changes: { targetEntityId }
                                            })
                                        }
                                    />
                                </div>
                            )}
                            {confirmation('deleteField', field.id)}
                        </li>
                    ))}
                </ul>
            )}
            {!data.fields.length && (
                <p className={styles.hint}>
                    No fields yet. Add a field before entering record values.
                </p>
            )}
            {data.fields.some((field) => field.type === 'text') && (
                <label className={styles.setting}>
                    Name records by
                    <select
                        value={data.label}
                        disabled={data.disabled}
                        onChange={(event) =>
                            edit({
                                kind: 'setLabelField',
                                entityId: entity.id,
                                fieldId: event.target.value
                            })
                        }
                    >
                        {data.fields
                            .filter((field) => field.type === 'text')
                            .map((field) => (
                                <option key={field.id} value={field.id}>
                                    {field.name}
                                </option>
                            ))}
                    </select>
                </label>
            )}
        </>
    );

    return (
        <section className={styles.dataView} aria-label="Data View">
            <nav className={styles.sidebar} aria-label="Entities">
                <h3 className={styles.sidebarTitle}>Entities</h3>
                {data.entities.length > 0 && (
                    <ul className={styles.entityList}>
                        {data.entities.map((entity) => (
                            <li key={entity.id}>
                                <button
                                    type="button"
                                    className={styles.entity}
                                    aria-current={entity.id === entityId || undefined}
                                    onClick={() => {
                                        setSelectedId(entity.id);
                                        setDeletion(undefined);
                                        if (!data.fieldCounts[entity.id]) {
                                            setTab('fields');
                                        }
                                    }}
                                >
                                    <Table2 aria-hidden size={14} />
                                    <span className={styles.entityName}>{entity.name}</span>
                                    <span
                                        className={styles.count}
                                        aria-label={`${data.recordCounts[entity.id] ?? 0} records`}
                                    >
                                        {data.recordCounts[entity.id] ?? 0}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                <form
                    className={styles.newEntity}
                    onSubmit={(event) => {
                        event.preventDefault();
                        const result = edit({ kind: 'addEntity', name });
                        if (result.applied) {
                            setSelectedId(result.id!);
                            setName('');
                            setTab('fields');
                        }
                    }}
                >
                    <input
                        ref={newEntity}
                        aria-label="New entity"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        disabled={data.disabled}
                        placeholder="New entity"
                    />
                    <button
                        className={styles.iconButton}
                        aria-label="Add entity"
                        title="Add entity"
                        disabled={data.disabled || !name.trim()}
                    >
                        <Plus aria-hidden size={14} strokeWidth={2.25} />
                    </button>
                </form>
            </nav>
            <div className={styles.main}>
                {!data.entity ? (
                    <div className={styles.emptyState}>
                        {notices}
                        <Database aria-hidden size={28} strokeWidth={1.5} />
                        <h3>No entities yet.</h3>
                        <p>
                            An entity is a kind of thing your prototype shows, like Customers or
                            Orders. Add one to define fields and sample records.
                        </p>
                        <button
                            type="button"
                            className={styles.primary}
                            disabled={data.disabled}
                            onClick={() => newEntity.current?.focus()}
                        >
                            <Plus aria-hidden size={14} strokeWidth={2.25} />
                            Create an entity
                        </button>
                        <p className={styles.hint}>
                            To repeat a component over records, select an instance and use Inspector
                            → Repeat with data.
                        </p>
                    </div>
                ) : (
                    <>
                        <header className={styles.toolbar}>
                            <ValueEditor
                                key={`${data.entity.id}:${data.entity.name}`}
                                variant="title"
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
                            <div
                                ref={tabList}
                                className={styles.segments}
                                role="tablist"
                                aria-label="Entity sections"
                            >
                                {TABS.map((section) => (
                                    <button
                                        key={section}
                                        type="button"
                                        role="tab"
                                        id={`${tabsId}-${section}`}
                                        aria-selected={tab === section}
                                        aria-controls={`${tabsId}-panel`}
                                        tabIndex={tab === section ? 0 : -1}
                                        onKeyDown={(event) => {
                                            const at = TABS.indexOf(section);
                                            const next =
                                                event.key === 'ArrowRight'
                                                    ? TABS[(at + 1) % TABS.length]
                                                    : event.key === 'ArrowLeft'
                                                      ? TABS[(at + TABS.length - 1) % TABS.length]
                                                      : undefined;
                                            if (next) {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                setTab(next);
                                                tabList.current
                                                    ?.querySelector<HTMLButtonElement>(
                                                        `#${CSS.escape(`${tabsId}-${next}`)}`
                                                    )
                                                    ?.focus();
                                            }
                                        }}
                                        onClick={() => setTab(section)}
                                    >
                                        {TAB_NAMES[section]}
                                        <span className={styles.count}>{tabCounts[section]}</span>
                                    </button>
                                ))}
                            </div>
                            <span className={styles.spacer} />
                            <button
                                type="button"
                                className={styles.primary}
                                title={data.fields.length ? undefined : 'Add a field first'}
                                disabled={
                                    data.disabled ||
                                    !data.fields.length ||
                                    data.records.length >= MAX_RECORDS_PER_ENTITY
                                }
                                onClick={() => {
                                    setTab('records');
                                    edit({ kind: 'addRecord', entityId: data.entity!.id });
                                }}
                            >
                                <Plus aria-hidden size={14} strokeWidth={2.25} />
                                Add record
                            </button>
                            <button
                                type="button"
                                className={styles.iconButton}
                                aria-label="Delete entity…"
                                title="Delete entity…"
                                disabled={data.disabled}
                                onClick={() =>
                                    setDeletion({
                                        kind: 'deleteEntity',
                                        id: data.entity!.id,
                                        documentId: data.documentId
                                    })
                                }
                            >
                                <Trash2 aria-hidden size={14} />
                            </button>
                        </header>
                        {confirmation('deleteEntity', data.entity.id)}
                        {notices}
                        <div
                            className={styles.tabPanel}
                            role="tabpanel"
                            id={`${tabsId}-panel`}
                            aria-labelledby={`${tabsId}-${tab}`}
                        >
                            {tab === 'records' && records}
                            {tab === 'fields' && fieldsPanel}
                            {tab === 'rules' && (
                                <DataRules
                                    key={data.entity.id}
                                    rules={data.rules}
                                    fields={data.fields}
                                    choices={data.choices}
                                    problems={data.brokenRules}
                                    disabled={data.disabled}
                                    add={(rule) =>
                                        edit({ kind: 'addRule', entityId: data.entity!.id, rule })
                                    }
                                    update={(id, rule) => edit({ kind: 'updateRule', id, rule })}
                                    remove={(id) => edit({ kind: 'deleteRule', id })}
                                />
                            )}
                        </div>
                    </>
                )}
            </div>
        </section>
    );
}

function EntitySelect({
    label,
    entities,
    value,
    disabled,
    change
}: {
    label: string;
    entities: { id: string; name: string }[];
    value?: string;
    disabled: boolean;
    change: (id: string) => void;
}) {
    return (
        <label>
            {label}
            <select
                value={value ?? ''}
                disabled={disabled}
                onChange={(event) => change(event.target.value)}
            >
                {!entities.some((entity) => entity.id === value) && (
                    <option value={value ?? ''}>Deleted entity</option>
                )}
                {entities.map((entity) => (
                    <option key={entity.id} value={entity.id}>
                        {entity.name}
                    </option>
                ))}
            </select>
        </label>
    );
}

/** Saves the whole list at once; a rejected list (duplicates, too long) keeps the draft. */
function OptionsEditor({
    label,
    options,
    disabled,
    save
}: {
    label: string;
    options: string[];
    disabled: boolean;
    save: (options: string[]) => DataEditResult;
}) {
    const initial = options.join('\n');
    const [draft, setDraft] = useState(initial);
    const [problem, setProblem] = useState('');

    return (
        <form
            className={styles.optionsEditor}
            data-changed={draft !== initial || undefined}
            onSubmit={(event) => {
                event.preventDefault();
                const result = save(optionLines(draft));
                setProblem(result.applied ? '' : result.problem);
            }}
        >
            <label>
                {label}
                <textarea
                    value={draft}
                    rows={Math.min(6, Math.max(2, options.length))}
                    disabled={disabled}
                    onChange={(event) => setDraft(event.target.value)}
                />
            </label>
            {draft !== initial && (
                <button
                    type="submit"
                    className={styles.primary}
                    disabled={disabled}
                    aria-label={`Save ${label}`}
                >
                    Save options
                </button>
            )}
            {problem && <small role="alert">{problem}</small>}
        </form>
    );
}
