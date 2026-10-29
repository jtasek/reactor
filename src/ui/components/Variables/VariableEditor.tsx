import { ordered } from 'src/app/variableModes';
import React, { FC, useState } from 'react';
import { ActionsMenu } from './ActionsMenu';
import type { Variable } from 'src/app/types';
import { useActions, useVariableContext, useCurrentDocument } from 'src/app/hooks';
import { resolveVariable, variableProblems } from 'src/app/variableResolver';
import { variableChain } from 'src/app/editorVariables';
import styles from './styles.css';
import { DraftField, ValueField } from './Fields';
import { TYPES } from './CreateVariable';
import { VariableBindings } from './VariableBindings';

export const VariableEditor: FC<{
    variable: Variable;
    variables: Record<string, Variable>;
    uses: number;
    onManageDimension: (id?: string) => void;
    onDeleted: () => void;
}> = ({ variable, variables, uses, onManageDimension, onDeleted }) => {
    const { deleteVariable, renameVariable, setVariableModeValue } = useActions();
    const context = useVariableContext();
    const document = useCurrentDocument();
    const dimension =
        variable.type !== 'boolean' ? document.dimensions[variable.dimensionId ?? ''] : undefined;
    const [confirming, setConfirming] = useState(false);
    const problems = variableProblems(variable, variables);
    const resolved =
        variable.alias !== undefined ? resolveVariable(variable, variables, context) : undefined;
    const remove = () => {
        deleteVariable(variable.id);
        onDeleted();
    };
    const focusValue = (modeId = 'default') =>
        requestAnimationFrame(() => {
            const field =
                globalThis.document.getElementById(`${variable.id}-${modeId}`) ??
                globalThis.document.getElementById(`variable-name-${variable.id}`);
            field?.focus();
        });

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
                        onClick={() => (uses > 0 ? setConfirming(true) : remove())}
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
                            onClick={remove}
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
            <VariableBindings
                variable={variable}
                variables={variables}
                onManageDimension={onManageDimension}
            />
            {variable.alias === undefined && !dimension && (
                <div className={styles.formField}>
                    <span className={styles.fieldLabel}>Value</span>
                    <ValueField variable={variable} variables={variables} />
                    <small className={styles.resolution}>The same value everywhere.</small>
                </div>
            )}
            {variable.alias === undefined && dimension && (
                <section key={dimension.id} aria-label={`Values for ${dimension.name}`}>
                    <div className={styles.sectionHeading}>
                        <h4>{dimension.name} values</h4>
                        <button type="button" onClick={() => onManageDimension(dimension.id)}>
                            Manage modes
                        </button>
                    </div>
                    <div className={styles.modeValues}>
                        {ordered(dimension.modes).map((mode) => {
                            const isDefault = mode.id === dimension.defaultModeId;
                            const inherited =
                                !isDefault &&
                                variable.type !== 'boolean' &&
                                variable.values[mode.id] === undefined;
                            const defaultName = dimension.modes[dimension.defaultModeId].name;

                            return (
                                <div
                                    className={styles.modeValue}
                                    key={`${mode.id}-${isDefault}`}
                                    role="group"
                                    aria-label={`${mode.name}${isDefault ? ' (default)' : ''}`}
                                >
                                    <label
                                        id={
                                            isDefault
                                                ? `${variable.id}-default-mode-name`
                                                : undefined
                                        }
                                        className={styles.modeName}
                                        htmlFor={`${variable.id}-${isDefault ? 'default' : mode.id}`}
                                    >
                                        {mode.name}
                                        {isDefault && (
                                            <small className={styles.resolution}>Default</small>
                                        )}
                                    </label>
                                    <div className={styles.formField}>
                                        <ValueField
                                            variable={variable}
                                            variables={variables}
                                            mode={isDefault ? undefined : mode}
                                            describedBy={
                                                isDefault
                                                    ? `${variable.id}-default-mode-name`
                                                    : undefined
                                            }
                                        />
                                        {inherited && (
                                            <small className={styles.resolution}>
                                                Uses {defaultName} value
                                            </small>
                                        )}
                                    </div>
                                    {!isDefault && !inherited && (
                                        <ActionsMenu
                                            label={`Actions for ${mode.name} value of ${variable.name}`}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setVariableModeValue({
                                                        variableId: variable.id,
                                                        modeId: mode.id,
                                                        value: null
                                                    });
                                                    focusValue(mode.id);
                                                }}
                                            >
                                                Reset to {defaultName} value
                                            </button>
                                        </ActionsMenu>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}
            {variable.alias !== undefined && (
                <div className={styles.formField}>
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
                </div>
            )}
            {problems.length > 0 && (
                <small className={styles.note} role="note">
                    Cannot show {problems.join(', ')}
                </small>
            )}
        </fieldset>
    );
};
