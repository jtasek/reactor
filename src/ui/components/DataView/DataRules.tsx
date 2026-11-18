import React, { useId, useState } from 'react';
import type { DataField, DataRule, DataValue } from 'src/app/dataTypes';
import type { DataEditResult, RuleContent } from 'src/app/dataEdits';
import type { Comparison, Condition, Operand } from 'src/app/expressions';
import styles from './styles.css';

type Choice = { value: string; label: string };
type Operator = Comparison | 'isSet' | 'isNotSet';

/** One comparison as the rule editor shows it: a field, an operator and a value or field. */
interface Row {
    fieldId: string;
    operator: Operator;
    right: { kind: 'value'; text: string } | { kind: 'field'; fieldId: string };
}
interface Group {
    match: 'and' | 'or';
    rows: Row[];
}

const OPERATORS: Record<Operator, string> = {
    equals: 'is',
    notEquals: 'is not',
    less: 'is less than',
    greater: 'is greater than',
    contains: 'contains',
    isSet: 'is set',
    isNotSet: 'is not set'
};

const operatorsFor = (field?: DataField): Operator[] => [
    'equals',
    'notEquals',
    ...(field?.type === 'number' ? (['less', 'greater'] as const) : []),
    ...(field?.type === 'text' ? (['contains'] as const) : []),
    'isSet',
    'isNotSet'
];

/**
 * Fields whose values compare with this one, never itself: the same kind of value, and for a
 * reference only another reference to the same entity.
 */
const comparableFields = (fields: DataField[], field?: DataField) =>
    fields.filter(
        (other) =>
            other.id !== field?.id &&
            (field?.type === 'reference' || other.type === 'reference'
                ? other.type === field?.type && other.targetEntityId === field.targetEntityId
                : field?.type === 'number' || field?.type === 'boolean'
                  ? other.type === field.type
                  : other.type === 'text' || other.type === field?.type)
    );

const emptyRow = (fields: DataField[]): Row => ({
    fieldId: fields[0]?.id ?? '',
    operator: 'isSet',
    right: { kind: 'value', text: '' }
});

/** A value as the editor holds it: options and record IDs as they are, booleans as words. */
const valueText = (value: DataValue) => (value === null ? '' : String(value));

/** Reads a stored condition back into rows, or undefined when the editor can't show its shape. */
function toGroup(condition: Condition): Group | undefined {
    const rows = 'conditions' in condition ? condition.conditions : [condition];
    const group: Group = {
        match: condition.kind === 'or' ? 'or' : 'and',
        rows: []
    };
    for (const item of rows) {
        const row = toRow(item);
        if (!row) {
            return undefined;
        }
        group.rows.push(row);
    }

    return group;
}

function toRow(condition: Condition): Row | undefined {
    const value = { kind: 'value' as const, text: '' };
    if (condition.kind === 'isSet' && condition.operand.kind === 'field') {
        return { fieldId: condition.operand.fieldId, operator: 'isSet', right: value };
    }
    if (
        condition.kind === 'not' &&
        condition.condition.kind === 'isSet' &&
        condition.condition.operand.kind === 'field'
    ) {
        return {
            fieldId: condition.condition.operand.fieldId,
            operator: 'isNotSet',
            right: value
        };
    }
    if (!('left' in condition) || condition.left.kind !== 'field') {
        return undefined;
    }
    const right = condition.right;
    if (right.kind === 'state') {
        return undefined;
    }

    return {
        fieldId: condition.left.fieldId,
        operator: condition.kind,
        right:
            right.kind === 'field'
                ? { kind: 'field', fieldId: right.fieldId }
                : { kind: 'value', text: valueText(right.value) }
    };
}

function fromRow(row: Row, fields: DataField[]): Condition {
    const field = fields.find((item) => item.id === row.fieldId);
    if (!field) {
        throw new Error('Choose a field for each condition.');
    }
    const left: Operand = { kind: 'field', fieldId: field.id };
    if (row.operator === 'isSet' || row.operator === 'isNotSet') {
        const isSet: Condition = { kind: 'isSet', operand: left };

        return row.operator === 'isSet' ? isSet : { kind: 'not', condition: isSet };
    }
    if (row.right.kind === 'field') {
        return {
            kind: row.operator,
            left,
            right: { kind: 'field', fieldId: row.right.fieldId }
        };
    }
    const text = row.right.text.trim();
    if (!text) {
        throw new Error(`Enter a value to compare ${field.name} with.`);
    }
    let value: DataValue = text;
    if (field.type === 'number') {
        value = Number(text);
        if (!Number.isFinite(value)) {
            throw new Error(`${field.name} compares with a number.`);
        }
    } else if (field.type === 'boolean') {
        value = text === 'true';
    }

    return { kind: row.operator, left, right: { kind: 'value', value } };
}

function fromGroup(group: Group, fields: DataField[]): Condition {
    const conditions = group.rows.map((row) => fromRow(row, fields));

    return conditions.length === 1 ? conditions[0] : { kind: group.match, conditions };
}

/** Plain words for any stored condition, including shapes the editor can't change. */
export function describeCondition(
    condition: Condition,
    fieldName: (id: string) => string,
    valueLabel: (fieldId: string | undefined, value: DataValue) => string
): string {
    const operand = (item: Operand, beside?: Operand) =>
        item.kind === 'field'
            ? fieldName(item.fieldId)
            : item.kind === 'state'
              ? `state ${item.stateId}`
              : item.value === null
                ? 'nothing'
                : `“${valueLabel(beside?.kind === 'field' ? beside.fieldId : undefined, item.value)}”`;
    const describe = (node: Condition, nested: boolean): string => {
        if ('conditions' in node) {
            const text = node.conditions
                .map((item) => describe(item, true))
                .join(node.kind === 'and' ? ' and ' : ' or ');

            return nested && node.conditions.length > 1 ? `(${text})` : text;
        }
        if (node.kind === 'not') {
            return node.condition.kind === 'isSet'
                ? `${operand(node.condition.operand)} is not set`
                : `not ${describe(node.condition, true)}`;
        }
        if (node.kind === 'isSet') {
            return `${operand(node.operand)} is set`;
        }

        return `${operand(node.left, node.right)} ${OPERATORS[node.kind]} ${operand(node.right, node.left)}`;
    };

    return describe(condition, false);
}

export function DataRules({
    rules,
    fields,
    choices,
    problems,
    disabled,
    add,
    update,
    remove
}: {
    rules: DataRule[];
    fields: DataField[];
    /** Choice options and referenced records by field ID, for values and their names. */
    choices: Record<string, Choice[]>;
    /** Why a rule can't run, by rule ID. */
    problems: Record<string, string[]>;
    disabled: boolean;
    add: (rule: RuleContent) => DataEditResult;
    update: (id: string, rule: RuleContent) => DataEditResult;
    remove: (id: string) => DataEditResult;
}) {
    const [editing, setEditing] = useState<string>();
    const fieldName = (id: string) =>
        fields.find((field) => field.id === id)?.name ?? 'a deleted field';
    const valueLabel = (fieldId: string | undefined, value: DataValue) =>
        choices[fieldId ?? '']?.find((choice) => choice.value === value)?.label ??
        (typeof value === 'boolean' ? (value ? 'True' : 'False') : String(value));
    const describe = (condition: Condition) => describeCondition(condition, fieldName, valueLabel);

    return (
        <section aria-label="Rules">
            <h3 className={styles.visuallyHidden}>Rules</h3>
            <p className={styles.hint}>
                A record must follow these rules to be saved from a Prototype form. Sample records
                that break one are listed under Needs attention.
            </p>
            {rules.map((rule) =>
                editing === rule.id ? (
                    <RuleForm
                        key={rule.id}
                        rule={rule}
                        fields={fields}
                        choices={choices}
                        disabled={disabled}
                        cancel={() => setEditing(undefined)}
                        save={(content) => {
                            const result = update(rule.id, content);
                            if (result.applied) {
                                setEditing(undefined);
                            }

                            return result;
                        }}
                    />
                ) : (
                    <div className={styles.rule} key={rule.id}>
                        <p>
                            <strong>{rule.message}</strong>
                            <span>
                                {rule.when && `When ${describe(rule.when)}: `}
                                {describe(rule.check)}
                                {rule.fieldId && ` · Shown at ${fieldName(rule.fieldId)}`}
                            </span>
                            {problems[rule.id]?.map((problem) => (
                                <small key={problem}>Can’t run: {problem}</small>
                            ))}
                        </p>
                        <button
                            type="button"
                            aria-label={`Edit rule “${rule.message}”`}
                            disabled={
                                disabled ||
                                editing !== undefined ||
                                !toGroup(rule.check) ||
                                Boolean(rule.when && !toGroup(rule.when))
                            }
                            onClick={() => setEditing(rule.id)}
                        >
                            Edit
                        </button>
                        <button
                            type="button"
                            aria-label={`Delete rule “${rule.message}”`}
                            disabled={disabled}
                            onClick={() => remove(rule.id)}
                        >
                            Delete
                        </button>
                    </div>
                )
            )}
            {!rules.length && <p className={styles.tableEmpty}>No rules yet.</p>}
            {editing === 'new' ? (
                <RuleForm
                    fields={fields}
                    choices={choices}
                    disabled={disabled}
                    cancel={() => setEditing(undefined)}
                    save={(content) => {
                        const result = add(content);
                        if (result.applied) {
                            setEditing(undefined);
                        }

                        return result;
                    }}
                />
            ) : (
                <button
                    type="button"
                    className={styles.primary}
                    disabled={disabled || !fields.length || editing !== undefined}
                    onClick={() => setEditing('new')}
                >
                    Add rule
                </button>
            )}
        </section>
    );
}

function RuleForm({
    rule,
    fields,
    choices,
    disabled,
    cancel,
    save
}: {
    rule?: DataRule;
    fields: DataField[];
    choices: Record<string, Choice[]>;
    disabled: boolean;
    cancel: () => void;
    save: (rule: RuleContent) => DataEditResult;
}) {
    const id = useId();
    const [check, setCheck] = useState<Group>(
        () => (rule && toGroup(rule.check)) || { match: 'and', rows: [emptyRow(fields)] }
    );
    const [when, setWhen] = useState<Group | undefined>(() => rule?.when && toGroup(rule.when));
    const [message, setMessage] = useState(rule?.message ?? '');
    // A message target deleted since keeps no option, so the whole record is shown instead.
    const [fieldId, setFieldId] = useState(() =>
        fields.some((field) => field.id === rule?.fieldId) ? rule!.fieldId! : ''
    );
    const [problem, setProblem] = useState('');

    return (
        <form
            className={styles.ruleForm}
            aria-label={rule ? `Edit rule ${rule.message}` : 'New rule'}
            onSubmit={(event) => {
                event.preventDefault();
                try {
                    const result = save({
                        check: fromGroup(check, fields),
                        ...(when && { when: fromGroup(when, fields) }),
                        message,
                        ...(fieldId && { fieldId })
                    });
                    setProblem(result.applied ? '' : result.problem);
                } catch (error) {
                    setProblem(error instanceof Error ? error.message : 'Check this rule.');
                }
            }}
        >
            <ConditionRows
                label="Records must have"
                group={check}
                fields={fields}
                choices={choices}
                disabled={disabled}
                change={setCheck}
            />
            <label className={styles.inline}>
                <input
                    type="checkbox"
                    checked={Boolean(when)}
                    disabled={disabled}
                    onChange={(event) =>
                        setWhen(
                            event.target.checked
                                ? { match: 'and', rows: [emptyRow(fields)] }
                                : undefined
                        )
                    }
                />
                Only when…
            </label>
            {when && (
                <ConditionRows
                    label="Only when"
                    group={when}
                    fields={fields}
                    choices={choices}
                    disabled={disabled}
                    change={setWhen}
                />
            )}
            <label>
                Message
                <input
                    value={message}
                    disabled={disabled}
                    placeholder="Customers must be adults"
                    onChange={(event) => setMessage(event.target.value)}
                />
            </label>
            <label>
                Show message at
                <select
                    id={`${id}-at`}
                    value={fieldId}
                    disabled={disabled}
                    onChange={(event) => setFieldId(event.target.value)}
                >
                    <option value="">The whole record</option>
                    {fields.map((field) => (
                        <option key={field.id} value={field.id}>
                            {field.name}
                        </option>
                    ))}
                </select>
            </label>
            <div className={styles.formActions}>
                <button type="button" onClick={cancel}>
                    Cancel
                </button>
                <button
                    type="submit"
                    className={styles.primary}
                    disabled={disabled || !message.trim()}
                >
                    {rule ? 'Save rule' : 'Add rule'}
                </button>
            </div>
            {problem && <small role="alert">{problem}</small>}
        </form>
    );
}

function ConditionRows({
    label,
    group,
    fields,
    choices,
    disabled,
    change
}: {
    label: string;
    group: Group;
    fields: DataField[];
    choices: Record<string, Choice[]>;
    disabled: boolean;
    change: (group: Group) => void;
}) {
    const setRow = (index: number, row: Row) =>
        change({ ...group, rows: group.rows.map((item, at) => (at === index ? row : item)) });

    return (
        <fieldset className={styles.conditions}>
            <legend>{label}</legend>
            {group.rows.length > 1 && (
                <label>
                    {`${label}: match`}
                    <select
                        value={group.match}
                        disabled={disabled}
                        onChange={(event) =>
                            change({ ...group, match: event.target.value as Group['match'] })
                        }
                    >
                        <option value="and">All conditions</option>
                        <option value="or">Any condition</option>
                    </select>
                </label>
            )}
            {group.rows.map((row, index) => {
                const field = fields.find((item) => item.id === row.fieldId);
                const name = `${label}, condition ${index + 1}`;
                const others = comparableFields(fields, field);
                const needsValue = row.operator !== 'isSet' && row.operator !== 'isNotSet';

                return (
                    <div className={styles.condition} key={index}>
                        <select
                            aria-label={`${name}: field`}
                            value={row.fieldId}
                            disabled={disabled}
                            onChange={(event) => {
                                const next = fields.find((item) => item.id === event.target.value);
                                setRow(index, {
                                    fieldId: event.target.value,
                                    operator: operatorsFor(next).includes(row.operator)
                                        ? row.operator
                                        : 'isSet',
                                    right: { kind: 'value', text: '' }
                                });
                            }}
                        >
                            {!field && <option value={row.fieldId}>Deleted field</option>}
                            {fields.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.name}
                                </option>
                            ))}
                        </select>
                        <select
                            aria-label={`${name}: comparison`}
                            value={row.operator}
                            disabled={disabled}
                            onChange={(event) =>
                                setRow(index, { ...row, operator: event.target.value as Operator })
                            }
                        >
                            {operatorsFor(field).map((operator) => (
                                <option key={operator} value={operator}>
                                    {OPERATORS[operator]}
                                </option>
                            ))}
                        </select>
                        {needsValue && others.length > 0 && row.operator !== 'contains' && (
                            <select
                                aria-label={`${name}: compare with`}
                                value={row.right.kind}
                                disabled={disabled}
                                onChange={(event) =>
                                    setRow(index, {
                                        ...row,
                                        right:
                                            event.target.value === 'field'
                                                ? { kind: 'field', fieldId: others[0].id }
                                                : { kind: 'value', text: '' }
                                    })
                                }
                            >
                                <option value="value">a value</option>
                                <option value="field">another field</option>
                            </select>
                        )}
                        {needsValue &&
                            (row.right.kind === 'field' ? (
                                <select
                                    aria-label={`${name}: other field`}
                                    value={row.right.fieldId}
                                    disabled={disabled}
                                    onChange={(event) =>
                                        setRow(index, {
                                            ...row,
                                            right: { kind: 'field', fieldId: event.target.value }
                                        })
                                    }
                                >
                                    {!others.some(
                                        (item) =>
                                            row.right.kind === 'field' &&
                                            item.id === row.right.fieldId
                                    ) && <option value={row.right.fieldId}>Deleted field</option>}
                                    {others.map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.name}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <ValueInput
                                    label={`${name}: value`}
                                    field={field}
                                    choices={
                                        row.operator === 'contains'
                                            ? undefined
                                            : choices[row.fieldId]
                                    }
                                    text={row.right.text}
                                    disabled={disabled}
                                    change={(text) =>
                                        setRow(index, { ...row, right: { kind: 'value', text } })
                                    }
                                />
                            ))}
                        {group.rows.length > 1 && (
                            <button
                                type="button"
                                aria-label={`Remove ${name}`}
                                disabled={disabled}
                                onClick={() =>
                                    change({
                                        ...group,
                                        rows: group.rows.filter((_, at) => at !== index)
                                    })
                                }
                            >
                                Remove
                            </button>
                        )}
                    </div>
                );
            })}
            <button
                type="button"
                className={styles.plain}
                disabled={disabled}
                onClick={() => change({ ...group, rows: [...group.rows, emptyRow(fields)] })}
            >
                Add condition
            </button>
        </fieldset>
    );
}

function ValueInput({
    label,
    field,
    choices,
    text,
    disabled,
    change
}: {
    label: string;
    field?: DataField;
    choices?: Choice[];
    text: string;
    disabled: boolean;
    change: (text: string) => void;
}) {
    const offered: Choice[] | undefined =
        field?.type === 'boolean'
            ? [
                  { value: 'true', label: 'True' },
                  { value: 'false', label: 'False' }
              ]
            : choices;
    if (offered) {
        return (
            <select
                aria-label={label}
                value={text}
                disabled={disabled}
                onChange={(event) => change(event.target.value)}
            >
                <option value="">Choose…</option>
                {offered.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                        {choice.label}
                    </option>
                ))}
                {text && !offered.some((choice) => choice.value === text) && (
                    <option value={text}>{text} (unavailable)</option>
                )}
            </select>
        );
    }

    return (
        <input
            aria-label={label}
            value={text}
            disabled={disabled}
            inputMode={field?.type === 'number' ? 'decimal' : undefined}
            onChange={(event) => change(event.target.value)}
        />
    );
}
