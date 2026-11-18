import React, { useEffect, useId, useRef, useState } from 'react';
import {
    Check,
    ChevronDown,
    ChevronRight,
    Minus,
    Plus,
    Table2,
    Trash2,
    TriangleAlert
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
import { DataMap, layoutEntities, type MapEntity } from './DataMap';
import { TypeIcon } from './TypeIcon';
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

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.5;
const ZOOM_STEP = 0.1;

/** Needs attention lists this many problems; the count above it says how many there are. */
const MAX_LISTED_PROBLEMS = 20;

/** One option per line; blank lines are ignored, the rest checked when saved. */
const optionLines = (draft: string) =>
    draft
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

/**
 * A value whose typing is a draft, saved on Enter or when the field loses focus and dropped on
 * Escape, as in the Inspector. A choice saves as soon as it is picked. A rejected value keeps its
 * draft and says why.
 */
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
    // A value stored as another type is saved again, converted, even when its text is unchanged.
    const needsConversion = value !== null && value !== undefined && typeof value !== expected;

    const commit = (text: string) => {
        if (disabled || (text === initial && !needsConversion)) {
            return;
        }
        if (type === 'boolean' && !['', 'true', 'false'].includes(text)) {
            setProblem('Choose True, False or Not set.');

            return;
        }
        const next =
            type === 'text'
                ? text
                : text.trim() === ''
                  ? null
                  : type === 'number'
                    ? Number(text)
                    : type === 'boolean'
                      ? text === 'true'
                      : text;
        const result = save(next);
        setProblem(result.applied ? '' : result.problem);
    };
    const pick = (text: string) => {
        setDraft(text);
        commit(text);
    };

    return (
        <div
            className={styles.valueEditor}
            data-variant={variant}
            data-problem={problem ? true : undefined}
        >
            {type === 'boolean' ? (
                <select
                    aria-label={label}
                    value={draft}
                    disabled={disabled}
                    onChange={(event) => pick(event.target.value)}
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
                    onFocus={() => setUsed(true)}
                    onPointerDown={() => setUsed(true)}
                    onChange={(event) => pick(event.target.value)}
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
                    aria-invalid={problem ? true : undefined}
                    value={draft}
                    disabled={disabled}
                    inputMode={type === 'number' ? 'decimal' : undefined}
                    onChange={(event) => setDraft(event.target.value)}
                    onBlur={() => commit(draft)}
                    onKeyDown={(event) => {
                        if (event.nativeEvent.isComposing) {
                            return;
                        }
                        if (event.key === 'Enter') {
                            commit(draft);
                        }
                        if (event.key === 'Escape' && draft !== initial) {
                            event.stopPropagation();
                            setDraft(initial);
                            setProblem('');
                        }
                    }}
                />
            )}
            {problem && <small role="alert">{problem}</small>}
        </div>
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
    const newField = useRef<HTMLInputElement>(null);
    const panel = useRef<HTMLElement>(null);
    const [selectedField, setSelectedField] = useState<string>();
    const [filter, setFilter] = useState('');
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [scale, setScale] = useState(1);
    const map = useRef<HTMLDivElement>(null);
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

        const model: MapEntity[] = entities.map((item) => ({
            id: item.id,
            name: item.name,
            records: recordCounts[item.id] ?? 0,
            labelFieldId: labelField(document, item.id)?.id,
            ...(item.mapPosition && { position: { ...item.mapPosition } }),
            fields: dataFields(document, item.id).map((field) => ({
                id: field.id,
                name: field.name,
                type: field.type,
                required: field.required,
                optionCount: field.options?.length ?? 0,
                targetEntityId: field.targetEntityId
            }))
        }));
        const fieldProblems: Record<string, number> = {};
        for (const problems of Object.values(cellProblems)) {
            for (const fieldId of Object.keys(problems)) {
                fieldProblems[fieldId] = (fieldProblems[fieldId] ?? 0) + 1;
            }
        }

        return {
            documentId: document.id,
            entities,
            model,
            fieldProblems,
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
    const choose = (id: string) => {
        if (id !== entityId) {
            setSelectedField(undefined);
        }
        setSelectedId(id);
        setDeletion(undefined);
        if (!data.fieldCounts[id]) {
            setTab('fields');
        }
    };
    const selectField = (owner: string, fieldId: string) => {
        choose(owner);
        setSelectedField(fieldId);
        setTab('fields');
        requestAnimationFrame(() =>
            panel.current
                ?.querySelector(`[data-field-id="${CSS.escape(fieldId)}"]`)
                ?.scrollIntoView?.({ block: 'nearest' })
        );
    };
    const addFieldTo = (owner: string) => {
        choose(owner);
        setTab('fields');
        requestAnimationFrame(() => newField.current?.focus());
    };
    const query = filter.trim().toLocaleLowerCase();
    const shownEntities = data.model
        .map((entity) => ({
            entity,
            fields: query
                ? entity.fields.filter((field) => field.name.toLocaleLowerCase().includes(query))
                : entity.fields
        }))
        .filter(
            ({ entity, fields }) =>
                !query || fields.length > 0 || entity.name.toLocaleLowerCase().includes(query)
        );
    const zoom = (next: number) =>
        setScale(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(next * 100) / 100)));
    const fit = () => {
        const { width, height } = layoutEntities(data.model);
        const box = map.current;
        if (box && width && height) {
            zoom(Math.min(1, box.clientWidth / width, box.clientHeight / height));
        }
    };
    const placed = data.model.some((entity) => entity.position);
    const references = data.model.reduce(
        (count, entity) =>
            count + entity.fields.filter((field) => field.type === 'reference').length,
        0
    );
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
                        ref={newField}
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
                <label className={styles.checkbox}>
                    <input
                        type="checkbox"
                        checked={required}
                        disabled={data.disabled}
                        onChange={(event) => setRequired(event.target.checked)}
                    />
                    Required
                </label>
                <button className={styles.primary} disabled={data.disabled || !fieldName.trim()}>
                    <Plus aria-hidden size={16} />
                    Add field
                </button>
            </form>
            {data.fields.length > 0 && (
                <ul className={styles.group} aria-label="Fields">
                    {data.fields.map((field) => (
                        <li
                            className={styles.field}
                            key={field.id}
                            data-field-id={field.id}
                            data-selected={field.id === selectedField || undefined}
                        >
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
                                <label className={styles.checkbox}>
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
        <section ref={panel} className={styles.dataView} aria-label="Data View">
            <nav className={styles.tree} aria-label="Entities">
                <input
                    type="search"
                    aria-label="Filter entities and fields"
                    placeholder="Filter entities and fields"
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                />
                <p className={styles.listHeading}>
                    Entities <span>{data.entities.length}</span>
                </p>
                <ul className={styles.treeList}>
                    {shownEntities.map(({ entity, fields }) => {
                        const open =
                            Boolean(query) || (expanded[entity.id] ?? entity.id === entityId);
                        const current = entity.id === entityId;

                        return (
                            <li key={entity.id}>
                                <div className={styles.treeRow} data-current={current || undefined}>
                                    <button
                                        type="button"
                                        className={styles.twisty}
                                        aria-label={`${open ? 'Hide' : 'Show'} fields of ${entity.name}`}
                                        aria-expanded={open}
                                        onClick={() =>
                                            setExpanded({ ...expanded, [entity.id]: !open })
                                        }
                                    >
                                        {open ? (
                                            <ChevronDown aria-hidden size={12} />
                                        ) : (
                                            <ChevronRight aria-hidden size={12} />
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        className={styles.treeItem}
                                        aria-current={current || undefined}
                                        onClick={() => choose(entity.id)}
                                    >
                                        <Table2 aria-hidden size={14} />
                                        <span>{entity.name}</span>
                                        <small>{entity.records}</small>
                                    </button>
                                </div>
                                {open && (
                                    <ul className={styles.treeList}>
                                        {fields.map((field) => (
                                            <li key={field.id}>
                                                <button
                                                    type="button"
                                                    className={styles.treeField}
                                                    aria-pressed={
                                                        current && field.id === selectedField
                                                    }
                                                    onClick={() => selectField(entity.id, field.id)}
                                                >
                                                    <TypeIcon type={field.type} />
                                                    <span>
                                                        {field.name}
                                                        {field.required && (
                                                            <span className={styles.required}>
                                                                {' *'}
                                                            </span>
                                                        )}
                                                    </span>
                                                    {current && data.fieldProblems[field.id] ? (
                                                        <small data-problem>
                                                            ⚠ {data.fieldProblems[field.id]}
                                                        </small>
                                                    ) : (
                                                        field.id === entity.labelFieldId && (
                                                            <small>names</small>
                                                        )
                                                    )}
                                                </button>
                                            </li>
                                        ))}
                                        {!query && (
                                            <li>
                                                <button
                                                    type="button"
                                                    className={styles.treeField}
                                                    aria-label={`Add field to ${entity.name}`}
                                                    disabled={data.disabled}
                                                    onClick={() => addFieldTo(entity.id)}
                                                >
                                                    <Plus aria-hidden size={12} />
                                                    <span className={styles.muted}>Add field</span>
                                                </button>
                                            </li>
                                        )}
                                    </ul>
                                )}
                            </li>
                        );
                    })}
                </ul>
                {data.entity && data.rules.length > 0 && (
                    <>
                        <p className={styles.listHeading}>
                            Rules <span>{data.rules.length}</span>
                        </p>
                        <ul className={styles.treeList}>
                            {data.rules.map((rule) => (
                                <li key={rule.id}>
                                    <button
                                        type="button"
                                        className={styles.treeItem}
                                        onClick={() => setTab('rules')}
                                    >
                                        <Check aria-hidden size={14} />
                                        <span>{rule.message}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
                <form
                    className={styles.newEntity}
                    onSubmit={(event) => {
                        event.preventDefault();
                        const result = edit({ kind: 'addEntity', name });
                        if (result.applied) {
                            setSelectedId(result.id!);
                            setSelectedField(undefined);
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
                        placeholder="New entity name"
                    />
                    <button disabled={data.disabled || !name.trim()}>
                        <Plus aria-hidden size={16} />
                        Add entity
                    </button>
                </form>
            </nav>
            <div className={styles.workArea}>
                <div className={styles.commandBar}>
                    <b>Data model</b>
                    <span className={styles.muted}>
                        {data.entities.length} {data.entities.length === 1 ? 'entity' : 'entities'}{' '}
                        · {references} {references === 1 ? 'reference' : 'references'}
                    </span>
                    {data.entities.length > 0 && (
                        <span className={styles.zoom} role="group" aria-label="Map zoom">
                            <button
                                type="button"
                                aria-label="Zoom out"
                                disabled={scale <= MIN_ZOOM}
                                onClick={() => zoom(scale - ZOOM_STEP)}
                            >
                                <Minus aria-hidden size={14} />
                            </button>
                            <button
                                type="button"
                                aria-label="Actual size"
                                title="Actual size"
                                onClick={() => zoom(1)}
                            >
                                {Math.round(scale * 100)}%
                            </button>
                            <button
                                type="button"
                                aria-label="Zoom in"
                                disabled={scale >= MAX_ZOOM}
                                onClick={() => zoom(scale + ZOOM_STEP)}
                            >
                                <Plus aria-hidden size={14} />
                            </button>
                            <button type="button" onClick={fit}>
                                Fit
                            </button>
                        </span>
                    )}
                    {placed && (
                        <button
                            type="button"
                            className={styles.plain}
                            disabled={data.disabled}
                            title="Let the map place every entity again"
                            onClick={() => edit({ kind: 'arrangeEntities' })}
                        >
                            Auto layout
                        </button>
                    )}
                </div>
                {data.entities.length > 0 && (
                    <DataMap
                        ref={map}
                        scale={scale}
                        disabled={data.disabled}
                        move={(id, position) => edit({ kind: 'moveEntity', id, position })}
                        entities={data.model}
                        selectedEntityId={entityId}
                        selectedFieldId={selectedField}
                        problems={data.fieldProblems}
                        selectEntity={choose}
                        selectField={selectField}
                        addField={addFieldTo}
                    />
                )}
                <div className={styles.drawer}>
                    {!data.entity ? (
                        <div className={styles.emptyState}>
                            {notices}
                            <h3>No entities yet.</h3>
                            <p>
                                An entity is a kind of thing your prototype shows, like Customers or
                                Orders. Name one under the entity list to define its fields and
                                sample records.
                            </p>
                            <p>
                                To repeat a component over records, select an instance and use
                                Inspector → Repeat with data.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className={styles.drawerHeader}>
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
                                    className={styles.tabs}
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
                                                          ? TABS[
                                                                (at + TABS.length - 1) % TABS.length
                                                            ]
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
                                            <span className={styles.count}>
                                                {tabCounts[section]}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                                <span className={styles.spacer} />
                                <button
                                    type="button"
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
                                    <Plus aria-hidden size={16} />
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
                                    <Trash2 aria-hidden size={15} />
                                </button>
                            </div>
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
                                            edit({
                                                kind: 'addRule',
                                                entityId: data.entity!.id,
                                                rule
                                            })
                                        }
                                        update={(id, rule) =>
                                            edit({ kind: 'updateRule', id, rule })
                                        }
                                        remove={(id) => edit({ kind: 'deleteRule', id })}
                                    />
                                )}
                            </div>
                        </>
                    )}
                </div>
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

/** Saves the whole list when the field loses focus; a rejected list (duplicates, too long) keeps the draft. */
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
        <div className={styles.optionsEditor}>
            <label>
                {label}
                <textarea
                    value={draft}
                    rows={Math.min(6, Math.max(2, options.length))}
                    disabled={disabled}
                    onChange={(event) => setDraft(event.target.value)}
                    onBlur={() => {
                        if (draft !== initial) {
                            const result = save(optionLines(draft));
                            setProblem(result.applied ? '' : result.problem);
                        }
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape' && draft !== initial) {
                            event.stopPropagation();
                            setDraft(initial);
                            setProblem('');
                        }
                    }}
                />
            </label>
            {problem && <small role="alert">{problem}</small>}
        </div>
    );
}
