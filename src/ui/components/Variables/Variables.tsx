import React, { FC, FormEvent, KeyboardEvent, useState } from 'react';
import type { Variable, VariableType } from 'src/app/types';
import { useActions } from 'src/app/hooks';
import { useVariableUses, useVariables } from 'src/app/variableHooks';
import { isVariableName, templateWithNames, variableDependencies } from 'src/app/variables';
import { resolveVariable, variableProblems } from 'src/app/variableResolver';
import { templateProblems, variableChain } from 'src/app/editorVariables';
import { SharedOnRelease } from '../Inspector/SharedOnRelease';
import styles from './styles.css';

const TYPES: { type: VariableType; label: string; value: Variable['values']['default'] }[] = [
    { type: 'color', label: 'Color', value: '#000000' },
    { type: 'number', label: 'Number', value: 0 },
    { type: 'text', label: 'Text', value: '' },
    { type: 'boolean', label: 'Boolean', value: false }
];

/** Where a `/` in a name puts a variable: the part before the last one. */
const GROUP_SEPARATOR = '/';

const groupName = (name: string) => {
    const end = name.lastIndexOf(GROUP_SEPARATOR);

    return end < 0 ? '' : name.slice(0, end);
};

/** Variables listed under their groups, in the order they come. */
const grouped = (variables: Variable[]) => {
    const groups = new Map<string, Variable[]>();

    variables.forEach((variable) => {
        const group = groupName(variable.name);

        groups.set(group, [...(groups.get(group) ?? []), variable]);
    });

    return [...groups];
};

/**
 * A text or number field whose typing is a draft: applied on Enter or blur, dropped
 * on Escape. It then shows `value` again, so a rejected change does not linger.
 */
const DraftField: FC<{
    label: string;
    value: string;
    type?: 'text' | 'number';
    onCommit: (text: string) => void;
}> = ({ label, value, type = 'text', onCommit }) => {
    const [draft, setDraft] = useState<string>();

    const commit = () => {
        if (draft !== undefined && draft !== value) {
            onCommit(draft);
        }

        setDraft(undefined);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.nativeEvent.isComposing) {
            return;
        }

        if (event.key === 'Enter') {
            commit();
        }

        if (event.key === 'Escape') {
            setDraft(undefined);
        }
    };

    return (
        <input
            type={type}
            step={type === 'number' ? 'any' : undefined}
            aria-label={label}
            value={draft ?? value}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
        />
    );
};

const ValueField: FC<{ variable: Variable; variables: Record<string, Variable> }> = ({
    variable,
    variables
}) => {
    const { setVariableValue } = useActions();
    const label = `Value of ${variable.name}`;
    const set = (value: unknown) => setVariableValue({ variableId: variable.id, value });

    switch (variable.type) {
        case 'color':
            return (
                <SharedOnRelease>
                    <input
                        type="color"
                        aria-label={label}
                        value={variable.values.default}
                        onChange={(event) => set(event.target.value)}
                    />
                </SharedOnRelease>
            );
        case 'number':
            return (
                <DraftField
                    label={label}
                    type="number"
                    value={String(variable.values.default)}
                    onCommit={(text) => {
                        if (text.trim() !== '') {
                            set(Number(text));
                        }
                    }}
                />
            );
        case 'text':
            return (
                <DraftField
                    label={label}
                    value={templateWithNames(variable.values.default, variables)}
                    onCommit={set}
                />
            );
        case 'boolean':
            return (
                <input
                    type="checkbox"
                    aria-label={label}
                    checked={variable.values.default}
                    onChange={(event) => set(event.target.checked)}
                />
            );
    }
};

const VariableRow: FC<{
    variable: Variable;
    variables: Record<string, Variable>;
    uses: number;
}> = ({ variable, variables, uses }) => {
    const { deleteVariable, renameVariable, setVariableAlias } = useActions();
    const [problem, setProblem] = useState<string>();
    const [confirming, setConfirming] = useState(false);
    const problems =
        variable.alias !== undefined
            ? variableProblems(variable, variables)
            : variable.type === 'text'
              ? templateProblems(variable.values.default, variables, [variable.id])
              : [];

    const sources = Object.values(variables).filter(
        (source) =>
            source.id === variable.alias ||
            (source.id !== variable.id &&
                source.type === variable.type &&
                !variableDependencies(source, variables).has(variable.id))
    );

    return (
        <li className={styles.row}>
            <div className={styles.rowHeader}>
                <DraftField
                    label={`Name of ${variable.name}`}
                    value={variable.name}
                    onCommit={(name) =>
                        renameVariable({ variableId: variable.id, name: name.trim() })
                    }
                />
                {confirming ? (
                    <span
                        className={styles.confirm}
                        role="group"
                        aria-label={`Delete ${variable.name}?`}
                    >
                        <button
                            type="button"
                            aria-label={`Confirm deleting ${variable.name}`}
                            onClick={() => deleteVariable(variable.id)}
                        >
                            Delete
                        </button>
                        <button type="button" onClick={() => setConfirming(false)}>
                            Keep
                        </button>
                    </span>
                ) : (
                    <button
                        type="button"
                        aria-label={`Delete ${variable.name}`}
                        onClick={() =>
                            uses > 0 ? setConfirming(true) : deleteVariable(variable.id)
                        }
                    >
                        ×
                    </button>
                )}
            </div>
            <div className={styles.metadata}>
                <span>{TYPES.find((item) => item.type === variable.type)?.label}</span>
                <span>
                    {uses === 0 ? 'Not used yet' : `${uses} ${uses === 1 ? 'use' : 'uses'}`}
                </span>
            </div>
            {variable.alias === undefined && (
                <label className={styles.field}>
                    <span className={styles.fieldLabel}>Value</span>
                    <ValueField variable={variable} variables={variables} />
                    {variable.type === 'color' && (
                        <code className={styles.colorValue}>{variable.values.default}</code>
                    )}
                </label>
            )}
            {sources.length > 0 || variable.alias !== undefined ? (
                <label className={styles.field}>
                    <span className={styles.fieldLabel}>Source</span>
                    <select
                        className={styles.source}
                        aria-label={`Source of ${variable.name}`}
                        value={variable.alias ?? ''}
                        onChange={(event) =>
                            setProblem(
                                setVariableAlias({
                                    variableId: variable.id,
                                    sourceId: event.target.value || null
                                })
                            )
                        }
                    >
                        <option value="">Literal value</option>
                        {sources.map((source) => (
                            <option key={source.id} value={source.id}>
                                Follow {source.name}
                            </option>
                        ))}
                    </select>
                </label>
            ) : (
                <small className={styles.resolution}>
                    {Object.values(variables).some(
                        (other) => other.id !== variable.id && other.type === variable.type
                    )
                        ? `Every other ${variable.type} variable follows ${variable.name}.`
                        : `Add another ${variable.type} variable to reference it.`}
                </small>
            )}
            {variable.alias !== undefined && (
                <small
                    className={styles.resolution}
                    aria-label={`Resolved value of ${variable.name}`}
                >
                    {variableChain(variable, variables)}:{' '}
                    {String(resolveVariable(variable, variables))}
                </small>
            )}
            {problem && (
                <small className={styles.note} role="alert">
                    {problem}
                </small>
            )}
            {problems.length > 0 && (
                <small className={styles.note} role="note">
                    Cannot show {problems.join(', ')}
                </small>
            )}
        </li>
    );
};

/**
 * The document's variables under their groups, each with its name and value to
 * edit, how many properties use it, and a delete that asks first when any does.
 */
export const Variables: FC = () => {
    const variables = useVariables();
    const byId = Object.fromEntries(variables.map((variable) => [variable.id, variable]));
    const uses = useVariableUses();
    const { createVariable } = useActions();
    const [name, setName] = useState('');
    const [type, setType] = useState<VariableType>('color');
    const [problem, setProblem] = useState<string>();

    const create = (event: FormEvent) => {
        event.preventDefault();

        const wanted = name.trim();
        const value = TYPES.find((item) => item.type === type)?.value;

        if (!isVariableName(wanted)) {
            setProblem('A name cannot be blank or hold {, } or $.');

            return;
        }

        if (!createVariable({ name: wanted, type, value })) {
            setProblem(`A variable is already named ${wanted}.`);

            return;
        }

        setName('');
        setProblem(undefined);
    };

    return (
        <section className={styles.variables} aria-label="Variables">
            <form className={styles.create} onSubmit={create}>
                <input
                    type="text"
                    aria-label="New variable name"
                    placeholder="brand/primary"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                />
                <select
                    aria-label="New variable type"
                    value={type}
                    onChange={(event) =>
                        setType(
                            TYPES.find((item) => item.type === event.target.value)?.type ?? type
                        )
                    }
                >
                    {TYPES.map((item) => (
                        <option key={item.type} value={item.type}>
                            {item.label}
                        </option>
                    ))}
                </select>
                <button type="submit">Add</button>
            </form>
            {problem && (
                <p className={styles.problem} role="alert">
                    {problem}
                </p>
            )}
            {variables.length === 0 ? (
                <p className={styles.empty}>No variables yet</p>
            ) : (
                grouped(variables).map(([group, members]) => (
                    <div key={group} className={styles.group}>
                        {group && <h4 className={styles.groupName}>{group}</h4>}
                        <ul>
                            {members.map((variable) => (
                                <VariableRow
                                    key={variable.id}
                                    variable={variable}
                                    variables={byId}
                                    uses={uses[variable.id] ?? 0}
                                />
                            ))}
                        </ul>
                    </div>
                ))
            )}
        </section>
    );
};
