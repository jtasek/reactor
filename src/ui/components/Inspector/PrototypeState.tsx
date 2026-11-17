import React, { useState, type FC } from 'react';
import { useActions } from 'src/app/hooks';
import type { PrototypeValue, StateValue } from 'src/app/types';
import type { PrototypeStateEdit } from 'src/app/interactionEdits';
import type { Comparison, Condition } from 'src/app/expressions';
import { simpleCondition, stateEquals, stateType, type StateType } from 'src/app/prototypeState';
import styles from './styles.css';

const SHOWN = 'shown';
const HIDDEN = 'hidden';
const OTHER = 'condition';

const TYPE_NAMES: Record<StateType, string> = {
    boolean: 'Yes/no',
    text: 'Text',
    number: 'Number'
};

/** The comparisons a visibility condition offers for each kind of state. */
const COMPARISON_NAMES: Record<'text' | 'number', [Comparison | 'isSet', string][]> = {
    text: [
        ['equals', 'is'],
        ['notEquals', 'is not'],
        ['contains', 'contains'],
        ['isSet', 'is not empty']
    ],
    number: [
        ['equals', 'is'],
        ['notEquals', 'is not'],
        ['less', 'is less than'],
        ['greater', 'is more than']
    ]
};

/** Reads typed text as a value of the state's type; undefined when it isn't one. */
export function stateInput(type: StateType, text: string): StateValue | undefined {
    if (type === 'text') {
        return text;
    }
    if (type === 'number') {
        const number = Number(text.trim());

        return text.trim() && Number.isFinite(number) ? number : undefined;
    }

    return text === 'true' ? true : text === 'false' ? false : undefined;
}

/** An editor for one value of a state's type that commits when it loses focus or on Enter. */
export const StateValueInput: FC<{
    type: StateType;
    value: StateValue;
    label: string;
    disabled: boolean;
    onCommit: (value: StateValue) => void;
}> = ({ type, value, label, disabled, onCommit }) => {
    if (type === 'boolean') {
        return (
            <select
                aria-label={label}
                value={String(value)}
                disabled={disabled}
                onChange={(event) => onCommit(event.target.value === 'true')}
            >
                <option value="true">On</option>
                <option value="false">Off</option>
            </select>
        );
    }

    return (
        <input
            key={String(value)}
            type="text"
            inputMode={type === 'number' ? 'decimal' : undefined}
            className={styles.stateValue}
            aria-label={label}
            defaultValue={String(value)}
            maxLength={1000}
            disabled={disabled}
            onKeyDown={(event) => {
                if (event.key === 'Enter') {
                    event.currentTarget.blur();
                }
            }}
            onBlur={(event) => {
                const next = stateInput(type, event.target.value);
                if (next === undefined) {
                    // Not a number: show the stored value again.
                    event.target.value = String(value);
                } else if (next !== value) {
                    onCommit(next);
                }
            }}
        />
    );
};

/** One choice for how an instance starts in the prototype: shown, hidden or following a state. */
export const PrototypeVisibility: FC<{
    instanceId: string;
    visible: boolean;
    condition?: Condition;
    text?: string;
    problems: string[];
    values: PrototypeValue[];
    blocked: string[];
    disabled: boolean;
}> = ({ instanceId, visible, condition, text, problems, values, blocked, disabled }) => {
    const { editInteractions } = useActions();
    const [problem, setProblem] = useState<string>();
    const simple = simpleCondition(condition);
    const state = simple && values.find((value) => value.id === simple.stateId);
    // The editors build one comparison of a kind that suits the state's type; anything else
    // (from AI, say, or a state value of another type) is shown in words and can be replaced.
    const followed =
        state &&
        simple &&
        (stateType(state) === 'boolean'
            ? simple.kind === 'equals' && typeof simple.value === 'boolean'
            : COMPARISON_NAMES[stateType(state) as 'text' | 'number'].some(
                  ([kind]) => kind === simple.kind
              ) &&
              (simple.kind === 'isSet' ||
                  typeof simple.value === (stateType(state) === 'text' ? 'string' : 'number')))
            ? state
            : undefined;
    const other = condition && !followed;
    const choices = values.filter(
        (value) => value.id === followed?.id || !blocked.includes(value.id)
    );
    const show = (next: Condition) =>
        setProblem(
            editInteractions({ target: 'state', kind: 'show', instanceId, condition: next })
        );
    const type = followed ? stateType(followed) : undefined;

    return (
        <div className={styles.interactionField}>
            <label htmlFor={`prototype-visibility-${instanceId}`}>In prototype</label>
            <select
                id={`prototype-visibility-${instanceId}`}
                aria-label="Prototype visibility"
                disabled={disabled}
                value={other ? OTHER : (followed?.id ?? (visible ? SHOWN : HIDDEN))}
                onChange={(event) => {
                    const choice = event.target.value;
                    const value = values.find((item) => item.id === choice);
                    if (value && stateType(value) !== 'boolean') {
                        // Shown at first: the value it starts with.
                        show(stateEquals(value.id, value.initial));

                        return;
                    }
                    setProblem(
                        editInteractions({
                            target: 'state',
                            kind: 'bind',
                            instanceId,
                            ...(choice === SHOWN || choice === HIDDEN
                                ? { stateId: null, visible: choice === SHOWN }
                                : { stateId: choice, when: true })
                        })
                    );
                }}
            >
                <option value={SHOWN}>Shown at start</option>
                <option value={HIDDEN}>Hidden at start</option>
                {other && <option value={OTHER}>When {text}</option>}
                {choices.length > 0 && (
                    <optgroup label="Follow state">
                        {choices.map((value) => (
                            <option key={value.id} value={value.id}>
                                Follow {value.name}
                            </option>
                        ))}
                    </optgroup>
                )}
            </select>
            {followed && simple && type === 'boolean' && (
                <label className={styles.interactionField}>
                    Show when
                    <select
                        aria-label="Show when"
                        value={String(simple.value)}
                        disabled={disabled}
                        onChange={(event) =>
                            setProblem(
                                editInteractions({
                                    target: 'state',
                                    kind: 'bind',
                                    instanceId,
                                    stateId: followed.id,
                                    when: event.target.value === 'true'
                                })
                            )
                        }
                    >
                        <option value="true">True</option>
                        <option value="false">False</option>
                    </select>
                </label>
            )}
            {followed && simple && type && type !== 'boolean' && (
                <div className={styles.prototypeStateRow}>
                    <select
                        aria-label="Show when the state"
                        value={simple.kind}
                        disabled={disabled}
                        onChange={(event) => {
                            const kind = event.target.value as Comparison | 'isSet';
                            show(
                                kind === 'isSet'
                                    ? { kind, operand: { kind: 'state', stateId: followed.id } }
                                    : {
                                          kind,
                                          left: { kind: 'state', stateId: followed.id },
                                          right: {
                                              kind: 'value',
                                              value: simple.value ?? followed.initial
                                          }
                                      }
                            );
                        }}
                    >
                        {COMPARISON_NAMES[type].map(([kind, name]) => (
                            <option key={kind} value={kind}>
                                {name}
                            </option>
                        ))}
                    </select>
                    {simple.kind !== 'isSet' && (
                        <StateValueInput
                            type={type}
                            value={(simple.value ?? followed.initial) as StateValue}
                            label="Show when the state has the value"
                            disabled={disabled}
                            onCommit={(value) =>
                                show({
                                    ...(condition as Extract<Condition, { left: unknown }>),
                                    right: { kind: 'value', value }
                                })
                            }
                        />
                    )}
                </div>
            )}
            {problems.length > 0 && (
                <small className={styles.frameHint}>
                    {problems[0]} It uses its start visibility.
                </small>
            )}
            {problem && <p role="alert">{problem}</p>}
        </div>
    );
};

/** Text properties that show a state's value in the prototype instead of their own text. */
export const StateBindings: FC<{
    instanceId: string;
    properties: { id: string; label: string; input: boolean; stateId?: string }[];
    values: PrototypeValue[];
    disabled: boolean;
}> = ({ instanceId, properties, values, disabled }) => {
    const { editInteractions } = useActions();
    const [problem, setProblem] = useState<string>();

    return (
        <>
            {properties.map((property) => {
                // A field writes what is typed, so it takes only text and number states.
                const choices = values.filter(
                    (value) => !property.input || stateType(value) !== 'boolean'
                );
                const missing =
                    property.stateId !== undefined &&
                    !values.some((value) => value.id === property.stateId);

                return (
                    <label key={property.id} className={styles.interactionField}>
                        {property.input
                            ? `${property.label} reads and writes`
                            : `${property.label} shows`}
                        <select
                            aria-label={`${property.label} in prototype`}
                            value={property.stateId ?? ''}
                            disabled={disabled}
                            onChange={(event) =>
                                setProblem(
                                    editInteractions({
                                        target: 'state',
                                        kind: 'bindProperty',
                                        instanceId,
                                        propId: property.id,
                                        stateId: event.target.value || null
                                    })
                                )
                            }
                        >
                            <option value="">Its own text</option>
                            {missing && <option value={property.stateId}>Missing state</option>}
                            {choices.map((value) => (
                                <option key={value.id} value={value.id}>
                                    {value.name}
                                </option>
                            ))}
                        </select>
                    </label>
                );
            })}
            {problem && <p role="alert">{problem}</p>}
        </>
    );
};

/** The document's named states: shared by every control, so editing them here affects all. */
export const PrototypeState: FC<{ values: PrototypeValue[]; disabled: boolean }> = ({
    values,
    disabled
}) => {
    const { editInteractions } = useActions();
    const [name, setName] = useState('');
    const [type, setType] = useState<StateType>('boolean');
    const [problem, setProblem] = useState<string>();
    const edit = (change: PrototypeStateEdit) => editInteractions(change);

    return (
        <details className={styles.prototypeState}>
            <summary>Prototype states{values.length > 0 ? ` (${values.length})` : ''}</summary>
            <p className={styles.frameHint}>
                Shared by every control in this document. Reset restores these initial values.
            </p>
            {values.map((value) => (
                <div key={value.id} className={styles.prototypeStateRow}>
                    <input
                        type="text"
                        key={value.name}
                        aria-label={`Name of ${value.name}`}
                        title={TYPE_NAMES[stateType(value)]}
                        defaultValue={value.name}
                        maxLength={100}
                        disabled={disabled}
                        onBlur={(event) => {
                            if (event.target.value === value.name) {
                                return;
                            }
                            const error = edit({
                                target: 'state',
                                kind: 'update',
                                id: value.id,
                                name: event.target.value,
                                initial: value.initial
                            });
                            if (error) {
                                // Show the stored name again; the alert says why.
                                event.target.value = value.name;
                            }
                            setProblem(error);
                        }}
                    />
                    {stateType(value) === 'boolean' ? (
                        <label>
                            <input
                                type="checkbox"
                                aria-label={`Initial value of ${value.name}`}
                                checked={value.initial === true}
                                disabled={disabled}
                                onChange={(event) =>
                                    setProblem(
                                        edit({
                                            target: 'state',
                                            kind: 'update',
                                            id: value.id,
                                            name: value.name,
                                            initial: event.target.checked
                                        })
                                    )
                                }
                            />
                            True
                        </label>
                    ) : (
                        <StateValueInput
                            type={stateType(value)}
                            value={value.initial}
                            label={`Initial value of ${value.name}`}
                            disabled={disabled}
                            onCommit={(initial) =>
                                setProblem(
                                    edit({
                                        target: 'state',
                                        kind: 'update',
                                        id: value.id,
                                        name: value.name,
                                        initial
                                    })
                                )
                            }
                        />
                    )}
                    <button
                        type="button"
                        disabled={disabled}
                        aria-label={`Delete state ${value.name}`}
                        onClick={() =>
                            setProblem(edit({ target: 'state', kind: 'delete', id: value.id }))
                        }
                    >
                        ×
                    </button>
                </div>
            ))}
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    const error = edit({
                        target: 'state',
                        kind: 'add',
                        name,
                        type,
                        initial: type === 'text' ? '' : type === 'number' ? 0 : false
                    });
                    setProblem(error);
                    if (!error) {
                        setName('');
                    }
                }}
                className={styles.prototypeStateRow}
            >
                <input
                    type="text"
                    aria-label="New state name"
                    placeholder="showHelp"
                    value={name}
                    disabled={disabled}
                    required
                    maxLength={100}
                    onChange={(event) => setName(event.target.value)}
                />
                <select
                    aria-label="New state type"
                    value={type}
                    disabled={disabled}
                    onChange={(event) => setType(event.target.value as StateType)}
                >
                    {(Object.keys(TYPE_NAMES) as StateType[]).map((item) => (
                        <option key={item} value={item}>
                            {TYPE_NAMES[item]}
                        </option>
                    ))}
                </select>
                <button type="submit" disabled={disabled || !name.trim()}>
                    Add state
                </button>
            </form>
            {problem && <p role="alert">{problem}</p>}
        </details>
    );
};
