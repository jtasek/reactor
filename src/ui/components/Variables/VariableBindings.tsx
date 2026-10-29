import React, { useState } from 'react';
import { useActions, useCurrentDocument } from 'src/app/hooks';
import type { Variable } from 'src/app/types';
import { ordered } from 'src/app/variableModes';
import { variableDependencies } from 'src/app/variables';
import styles from './styles.css';
import { Dialog } from '../Dialog';

/** Variables this one may follow without making a loop, plus the one it follows. */
const aliasSources = (variable: Variable, variables: Record<string, Variable>) =>
    Object.values(variables).filter(
        (source) =>
            source.id === variable.alias ||
            (source.id !== variable.id &&
                source.type === variable.type &&
                !variableDependencies(source, variables).has(variable.id))
    );

/** Source and dimension choices stay visible beside the variable's values. */
export function VariableBindings({
    variable,
    variables,
    onManageDimension
}: {
    variable: Variable;
    variables: Record<string, Variable>;
    onManageDimension: (id?: string) => void;
}) {
    const document = useCurrentDocument();
    const { setVariableDimension, setVariableAlias } = useActions();
    const [pending, setPending] = useState<{ from?: string; to: string }>();
    const [problem, setProblem] = useState<string>();
    const dimensionId = variable.type === 'boolean' ? undefined : variable.dimensionId;
    const dimension = document.dimensions[dimensionId ?? ''];
    const dimensions = ordered(document.dimensions);
    const sources = aliasSources(variable, variables);
    const confirmation =
        pending && pending.from === dimensionId && (!pending.to || document.dimensions[pending.to])
            ? pending
            : undefined;

    const changeDimension = (id: string) => {
        if (id === (dimensionId ?? '')) {
            return;
        }
        if (Object.keys(variable.values).some((key) => key !== 'default')) {
            setPending({ from: dimensionId, to: id });

            return;
        }
        setVariableDimension({ variableId: variable.id, dimensionId: id || null });
    };

    return (
        <>
            {(sources.length > 0 || variable.alias !== undefined) && (
                <label className={styles.formField}>
                    Value source
                    <select
                        aria-label={`Source of ${variable.name}`}
                        value={variable.alias ?? ''}
                        onChange={(event) => {
                            setPending(undefined);
                            setProblem(
                                setVariableAlias({
                                    variableId: variable.id,
                                    sourceId: event.target.value || null
                                })
                            );
                        }}
                    >
                        <option value="">Own value</option>
                        {sources.map((source) => (
                            <option key={source.id} value={source.id}>
                                Follow {source.name}
                            </option>
                        ))}
                    </select>
                </label>
            )}
            {variable.type !== 'boolean' && variable.alias === undefined && (
                <>
                    <label className={styles.formField}>
                        Values depend on
                        <select
                            aria-label={`Dimension of ${variable.name}`}
                            value={dimensionId ?? ''}
                            onChange={(event) => changeDimension(event.target.value)}
                        >
                            <option value="">Nothing — one value everywhere</option>
                            {dimensions.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    {confirmation && (
                        <Dialog
                            visible
                            title="Change dimension?"
                            description={`Change from ${dimension?.name ?? 'one value'} to ${document.dimensions[confirmation.to]?.name ?? 'one value'}? The ${dimension?.modes[dimension.defaultModeId]?.name ?? 'current'} value stays. Other named values will be removed from this variable.`}
                            onClose={() => setPending(undefined)}
                            actions={
                                <>
                                    <button type="button" onClick={() => setPending(undefined)}>
                                        Keep dimension
                                    </button>
                                    <button
                                        type="button"
                                        data-variant="primary"
                                        disabled={document.locked}
                                        onClick={() => {
                                            setVariableDimension({
                                                variableId: variable.id,
                                                dimensionId: confirmation.to || null
                                            });
                                            setPending(undefined);
                                        }}
                                    >
                                        Change dimension
                                    </button>
                                </>
                            }
                        />
                    )}
                    {!dimension && (
                        <button type="button" onClick={() => onManageDimension()}>
                            New dimension…
                        </button>
                    )}
                </>
            )}
            {problem && (
                <p className={styles.note} role="alert">
                    {problem}
                </p>
            )}
        </>
    );
}
