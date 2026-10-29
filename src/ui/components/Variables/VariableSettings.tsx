import React, { useEffect, useRef, useState } from 'react';
import { useActions, useCurrentDocument } from 'src/app/hooks';
import type { Variable } from 'src/app/types';
import { ordered } from 'src/app/variableModes';
import { variableDependencies } from 'src/app/variables';
import styles from './styles.css';

/** Variables this one may follow without making a loop, plus the one it follows. */
export const aliasSources = (variable: Variable, variables: Record<string, Variable>) =>
    Object.values(variables).filter(
        (source) =>
            source.id === variable.alias ||
            (source.id !== variable.id &&
                source.type === variable.type &&
                !variableDependencies(source, variables).has(variable.id))
    );

/** Whether `VariableSettings` has anything to offer: a dimension or a value source. */
export const hasVariableSettings = (variable: Variable, variables: Record<string, Variable>) =>
    variable.type !== 'boolean' || aliasSources(variable, variables).length > 0;

/** Structural choices are separate from everyday value editing. */
export function VariableSettings({
    variable,
    variables,
    onDone,
    onManageDimension
}: {
    variable: Variable;
    variables: Record<string, Variable>;
    onDone: () => void;
    onManageDimension: (id?: string) => void;
}) {
    const document = useCurrentDocument();
    const { setVariableDimension, setVariableAlias } = useActions();
    const [pending, setPending] = useState<{ from?: string; to: string }>();
    const [problem, setProblem] = useState<string>();
    const section = useRef<HTMLElement>(null);
    const dimensionId = variable.type === 'boolean' ? undefined : variable.dimensionId;
    const dimension = document.dimensions[dimensionId ?? ''];
    const dimensions = ordered(document.dimensions);
    const sources = aliasSources(variable, variables);
    const confirmation =
        pending && pending.from === dimensionId && (!pending.to || document.dimensions[pending.to])
            ? pending
            : undefined;
    useEffect(() => {
        section.current?.querySelector<HTMLElement>('select, button')?.focus();
    }, []);

    const changeDimension = (id: string) => {
        if (id === (dimensionId ?? '')) {
            return;
        }
        if (Object.keys(variable.values).some((key) => key !== 'default')) {
            setPending({ from: dimensionId, to: id });

            return;
        }
        setVariableDimension({ variableId: variable.id, dimensionId: id || null });
        onDone();
    };

    return (
        <section ref={section} className={styles.settings} aria-label="Variable settings">
            <h4>Variable settings</h4>
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
                    <p className={styles.resolution}>
                        {dimension
                            ? `${dimension.name}: ${ordered(dimension.modes)
                                  .map((mode) => mode.name)
                                  .join(', ')}.`
                            : 'A dimension is a category: Theme has Light and Dark modes; Size could have Small and Large.'}
                    </p>
                    {confirmation && (
                        <div className={styles.notice} role="alert">
                            <p>
                                Change from {dimension?.name ?? 'one value'} to{' '}
                                {document.dimensions[confirmation.to]?.name ?? 'one value'}? The{' '}
                                {dimension?.modes[dimension.defaultModeId]?.name ?? 'current'} value
                                stays. Other named values will be removed from this variable.
                            </p>
                            <div className={styles.actions}>
                                <button type="button" onClick={() => setPending(undefined)}>
                                    Keep dimension
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setVariableDimension({
                                            variableId: variable.id,
                                            dimensionId: confirmation.to || null
                                        });
                                        onDone();
                                    }}
                                >
                                    Change dimension
                                </button>
                            </div>
                        </div>
                    )}
                    {!dimension && (
                        <button type="button" onClick={() => onManageDimension()}>
                            New dimension…
                        </button>
                    )}
                </>
            )}
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
            {problem && (
                <p className={styles.note} role="alert">
                    {problem}
                </p>
            )}
            <div className={styles.actions}>
                <button type="button" onClick={onDone}>
                    Done
                </button>
            </div>
        </section>
    );
}
