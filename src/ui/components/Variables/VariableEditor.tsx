import { ordered } from 'src/app/variableModes';
import React, { FC, useState } from 'react';
import { ActionsMenu } from './ActionsMenu';
import type { Variable } from 'src/app/types';
import { useActions, useVariableContext, useCurrentDocument } from 'src/app/hooks';
import { templateWithNames, variableDependencies } from 'src/app/variables';
import { resolveVariable, variableProblems } from 'src/app/variableResolver';
import { variableChain } from 'src/app/editorVariables';
import { SharedOnRelease } from '../Inspector/SharedOnRelease';
import styles from './styles.css';

import { DraftField, ValueField } from './Fields';
import { TYPES } from './CreateVariable';
export const VariableEditor: FC<{
    variable: Variable;
    variables: Record<string, Variable>;
    uses: number;
    onManageDimension: (id?: string) => void;
}> = ({ variable, variables, uses, onManageDimension }) => {
    const {
        deleteVariable,
        renameVariable,
        setVariableAlias,
        setVariableModeValue,
        setVariableDimension
    } = useActions();
    const theme = useVariableContext();
    const document = useCurrentDocument();
    // The default mode's color is the base value, edited in the value field.
    const dimension =
        variable.type !== 'boolean' && variable.dimensionId !== undefined
            ? document.dimensions[variable.dimensionId]
            : undefined;
    const [problem, setProblem] = useState<string>();
    const [confirming, setConfirming] = useState(false);
    const [pendingDimension, setPendingDimension] = useState<string>();
    const problems = variableProblems(variable, variables);
    const focusMode = (modeId: string) =>
        requestAnimationFrame(() => {
            globalThis.document.getElementById(`${variable.id}-${modeId}`)?.focus();
        });

    const resolved =
        variable.alias !== undefined ? resolveVariable(variable, variables, theme) : undefined;

    const sources = Object.values(variables).filter(
        (source) =>
            source.id === variable.alias ||
            (source.id !== variable.id &&
                source.type === variable.type &&
                !variableDependencies(source, variables).has(variable.id))
    );

    return (
        <fieldset disabled={document.locked} className={styles.row}>
            <div className={styles.rowHeader}>
                <label className={styles.formField} htmlFor={`variable-name-${variable.id}`}>
                    Name
                    <DraftField
                        id={`variable-name-${variable.id}`}
                        label={`Name of ${variable.name}`}
                        value={variable.name}
                        onCommit={(name) =>
                            renameVariable({ variableId: variable.id, name: name.trim() })
                        }
                    />
                </label>
                <ActionsMenu label={`Actions for ${variable.name}`}>
                    <button
                        type="button"
                        aria-label={`Delete ${variable.name}`}
                        onClick={() =>
                            uses > 0 ? setConfirming(true) : deleteVariable(variable.id)
                        }
                    >
                        Delete variable
                    </button>
                </ActionsMenu>
            </div>
            {confirming && (
                <div className={styles.notice} role="group" aria-label={`Delete ${variable.name}?`}>
                    <p>Delete {variable.name}? Existing uses keep their current values.</p>
                    <div className={styles.actions}>
                        <button type="button" onClick={() => setConfirming(false)}>
                            Keep
                        </button>
                        <button
                            type="button"
                            aria-label={`Confirm deleting ${variable.name}`}
                            onClick={() => deleteVariable(variable.id)}
                        >
                            Delete
                        </button>
                    </div>
                </div>
            )}
            <div className={styles.metadata}>
                <span>{TYPES.find((item) => item.type === variable.type)?.label}</span>
                <span>
                    {uses === 0 ? 'Not used yet' : `${uses} ${uses === 1 ? 'use' : 'uses'}`}
                </span>
            </div>
            {variable.alias === undefined && (
                // A caption click would flip a boolean, so only other fields take it as a label.
                <div className={styles.formField}>
                    <span className={styles.fieldLabel}>
                        {variable.type === 'boolean' ? 'Value' : 'Base value'}
                    </span>
                    <ValueField variable={variable} variables={variables} />
                    <small className={styles.resolution}>
                        {dimension
                            ? `Used by ${dimension.modes[dimension.defaultModeId]?.name} and modes without an override.`
                            : 'The same value everywhere.'}
                    </small>
                </div>
            )}
            {variable.type !== 'boolean' &&
                variable.alias === undefined &&
                Object.keys(document.dimensions).length > 0 && (
                    <details className={styles.section} open={dimension !== undefined}>
                        <summary>
                            {dimension ? 'Mode values' : 'Add mode values · Optional'}
                        </summary>
                        <div className={styles.formField}>
                            <span className={styles.fieldLabel}>Vary by</span>
                            <div className={styles.valueInput}>
                                <select
                                    className={styles.source}
                                    aria-label={`Dimension of ${variable.name}`}
                                    value={variable.dimensionId ?? ''}
                                    onChange={(event) => {
                                        if (
                                            Object.keys(variable.values).some(
                                                (key) => key !== 'default'
                                            )
                                        ) {
                                            setPendingDimension(event.target.value);

                                            return;
                                        }
                                        setVariableDimension({
                                            variableId: variable.id,
                                            dimensionId: event.target.value || null
                                        });
                                    }}
                                >
                                    <option value="">None — base value only</option>
                                    {ordered(document.dimensions).map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.name}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={() => onManageDimension(dimension?.id)}
                                >
                                    {dimension ? 'Manage modes' : 'New dimension…'}
                                </button>
                            </div>
                        </div>
                        {pendingDimension !== undefined && (
                            <div className={styles.notice} role="alert">
                                <p>
                                    Changing this dimension removes this variable’s mode overrides.
                                    Its base value stays.
                                </p>
                                <div className={styles.actions}>
                                    <button
                                        type="button"
                                        onClick={() => setPendingDimension(undefined)}
                                    >
                                        Keep dimension
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setVariableDimension({
                                                variableId: variable.id,
                                                dimensionId: pendingDimension || null
                                            });
                                            setPendingDimension(undefined);
                                        }}
                                    >
                                        Change dimension
                                    </button>
                                </div>
                            </div>
                        )}
                        {dimension &&
                            ordered(dimension.modes)
                                .filter((mode) => mode.id !== dimension.defaultModeId)
                                .map((mode) => (
                                    <div className={styles.field} key={mode.id}>
                                        <label
                                            className={styles.fieldLabel}
                                            htmlFor={`${variable.id}-${mode.id}`}
                                        >
                                            {mode.name}
                                        </label>
                                        {variable.values[mode.id] === undefined ? (
                                            <div className={styles.inheritedValue}>
                                                <small className={styles.resolution}>
                                                    Uses base ·{' '}
                                                    {variable.type === 'text'
                                                        ? templateWithNames(
                                                              variable.values.default,
                                                              variables
                                                          )
                                                        : String(variable.values.default)}
                                                </small>
                                                <button
                                                    id={`${variable.id}-${mode.id}`}
                                                    type="button"
                                                    aria-label={`Override ${variable.name} in ${mode.name}`}
                                                    onClick={() => {
                                                        setVariableModeValue({
                                                            variableId: variable.id,
                                                            modeId: mode.id,
                                                            value:
                                                                variable.type === 'text'
                                                                    ? templateWithNames(
                                                                          variable.values.default,
                                                                          variables
                                                                      )
                                                                    : variable.values.default
                                                        });
                                                        focusMode(mode.id);
                                                    }}
                                                >
                                                    Override
                                                </button>
                                            </div>
                                        ) : variable.type !== 'color' ? (
                                            <DraftField
                                                id={`${variable.id}-${mode.id}`}
                                                label={`${mode.name} value of ${variable.name}`}
                                                type={
                                                    variable.type === 'number' ? 'number' : 'text'
                                                }
                                                value={
                                                    variable.type === 'text'
                                                        ? templateWithNames(
                                                              variable.values[mode.id] ??
                                                                  variable.values.default,
                                                              variables
                                                          )
                                                        : String(
                                                              variable.values[mode.id] ??
                                                                  variable.values.default
                                                          )
                                                }
                                                onCommit={(value) => {
                                                    if (
                                                        variable.type === 'number' &&
                                                        value.trim() === ''
                                                    ) {
                                                        return;
                                                    }
                                                    setVariableModeValue({
                                                        variableId: variable.id,
                                                        modeId: mode.id,
                                                        value:
                                                            variable.type === 'number'
                                                                ? Number(value)
                                                                : value
                                                    });
                                                }}
                                            />
                                        ) : (
                                            <div className={styles.valueInput}>
                                                <SharedOnRelease>
                                                    <input
                                                        id={`${variable.id}-${mode.id}`}
                                                        type="color"
                                                        aria-label={`${mode.name} value of ${variable.name}`}
                                                        value={
                                                            variable.values[mode.id] ??
                                                            variable.values.default
                                                        }
                                                        onChange={(event) =>
                                                            setVariableModeValue({
                                                                variableId: variable.id,
                                                                modeId: mode.id,
                                                                value: event.target.value
                                                            })
                                                        }
                                                    />
                                                </SharedOnRelease>
                                                <DraftField
                                                    label={`${mode.name} hex value of ${variable.name}`}
                                                    value={
                                                        variable.values[mode.id] ??
                                                        variable.values.default
                                                    }
                                                    onCommit={(value) =>
                                                        setVariableModeValue({
                                                            variableId: variable.id,
                                                            modeId: mode.id,
                                                            value
                                                        })
                                                    }
                                                />
                                            </div>
                                        )}
                                        {variable.values[mode.id] !== undefined && (
                                            <button
                                                type="button"
                                                aria-label={`Use base value for ${variable.name} in ${mode.name}`}
                                                onClick={() => {
                                                    setVariableModeValue({
                                                        variableId: variable.id,
                                                        modeId: mode.id,
                                                        value: null
                                                    });
                                                    focusMode(mode.id);
                                                }}
                                            >
                                                Use base
                                            </button>
                                        )}
                                    </div>
                                ))}
                    </details>
                )}
            {variable.type !== 'boolean' &&
                variable.alias === undefined &&
                Object.keys(document.dimensions).length === 0 && (
                    <details className={styles.section}>
                        <summary>Add mode values · Optional</summary>
                        <p className={styles.resolution}>
                            Create a dimension to give this variable different values in different
                            modes.
                        </p>
                        <button type="button" onClick={() => onManageDimension()}>
                            New dimension…
                        </button>
                    </details>
                )}
            {variable.type === 'boolean' && Object.keys(document.dimensions).length > 0 && (
                <small className={styles.resolution}>
                    State variables currently have one base value.
                </small>
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
                    {variable.type === 'color' && typeof resolved === 'string' && (
                        <span
                            className={styles.swatch}
                            style={{ backgroundColor: resolved }}
                            aria-hidden="true"
                        />
                    )}
                    {variableChain(variable, variables)}: {String(resolved)}
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
        </fieldset>
    );
};
