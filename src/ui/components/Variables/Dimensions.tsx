import React, { useState } from 'react';
import { useActions, useCurrentDocument, useVariableContext } from 'src/app/hooks';
import { ordered } from 'src/app/variableModes';
import type { VariableDimension } from 'src/app/types';
import styles from './styles.css';

function DimensionEditor({ dimension }: { dimension: VariableDimension }) {
    const { updateDimension, addDimensionMode, deleteDimensionMode, deleteDimension } =
        useActions();
    const document = useCurrentDocument();
    const [name, setName] = useState('');
    const [deleting, setDeleting] = useState<string>();
    const modes = ordered(dimension.modes);
    const move = (id: string, direction: number) => {
        const index = modes.findIndex((mode) => mode.id === id);
        const other = modes[index + direction];
        if (!other) return;
        const next = [...modes];
        [next[index], next[index + direction]] = [next[index + direction], next[index]];
        updateDimension({
            ...dimension,
            modes: Object.fromEntries(next.map((mode, order) => [mode.id, { ...mode, order }]))
        });
    };
    return (
        <fieldset disabled={document.locked} className={styles.dimension}>
            <legend>{dimension.name}</legend>
            <label className={styles.field}>
                <span className={styles.fieldLabel}>Name</span>
                <input
                    aria-label={`Name of dimension ${dimension.name}`}
                    defaultValue={dimension.name}
                    key={dimension.name}
                    onBlur={(event) => {
                        updateDimension({ ...dimension, name: event.target.value });
                        event.target.value = dimension.name;
                    }}
                />
            </label>
            <label className={styles.field}>
                <span className={styles.fieldLabel}>Default</span>
                <select
                    className={styles.source}
                    aria-label={`Default mode for ${dimension.name}`}
                    value={dimension.defaultModeId}
                    onChange={(event) =>
                        updateDimension({ ...dimension, defaultModeId: event.target.value })
                    }
                >
                    {modes.map((mode) => (
                        <option key={mode.id} value={mode.id}>
                            {mode.name}
                        </option>
                    ))}
                </select>
            </label>
            {modes.map((mode, index) => (
                <div className={styles.field} key={mode.id}>
                    <input
                        aria-label={`Name of mode ${mode.name} in ${dimension.name}`}
                        defaultValue={mode.name}
                        key={mode.name}
                        onBlur={(event) => {
                            updateDimension({
                                ...dimension,
                                modes: {
                                    ...dimension.modes,
                                    [mode.id]: { ...mode, name: event.target.value }
                                }
                            });
                            event.target.value = mode.name;
                        }}
                    />
                    <button
                        type="button"
                        aria-label={`Move ${mode.name} up`}
                        disabled={index === 0}
                        onClick={() => move(mode.id, -1)}
                    >
                        ↑
                    </button>
                    <button
                        type="button"
                        aria-label={`Move ${mode.name} down`}
                        disabled={index === modes.length - 1}
                        onClick={() => move(mode.id, 1)}
                    >
                        ↓
                    </button>
                    <button
                        type="button"
                        aria-label={`Delete mode ${mode.name}`}
                        disabled={modes.length === 1}
                        onClick={() => setDeleting(mode.id)}
                    >
                        ×
                    </button>
                </div>
            ))}
            <form
                className={styles.field}
                onSubmit={(event) => {
                    event.preventDefault();
                    addDimensionMode({ dimensionId: dimension.id, name });
                    setName('');
                }}
            >
                <input
                    aria-label={`New mode in ${dimension.name}`}
                    placeholder="Mode name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                />
                <button
                    type="submit"
                    disabled={!name.trim() || modes.some((mode) => mode.name === name.trim())}
                >
                    Add mode
                </button>
            </form>
            <button type="button" onClick={() => setDeleting(dimension.id)}>
                Delete dimension
            </button>
            {deleting && (
                <div role="group" aria-label="Confirm deletion">
                    <p>
                        Delete{' '}
                        {deleting === dimension.id
                            ? 'this dimension and its mode values'
                            : 'this mode and its values'}
                        ? Base values remain.
                    </p>
                    <button
                        type="button"
                        onClick={() => {
                            if (deleting === dimension.id) deleteDimension(dimension.id);
                            else
                                deleteDimensionMode({
                                    dimensionId: dimension.id,
                                    modeId: deleting
                                });
                            setDeleting(undefined);
                        }}
                    >
                        Delete
                    </button>
                    <button type="button" onClick={() => setDeleting(undefined)}>
                        Keep
                    </button>
                </div>
            )}
        </fieldset>
    );
}

export function Dimensions() {
    const document = useCurrentDocument();
    const context = useVariableContext();
    const { createDimension, setPreviewMode, updateDimension } = useActions();
    const [name, setName] = useState('');
    const dimensions = ordered(document.dimensions);
    const move = (index: number, direction: number) => {
        const next = [...dimensions];
        if (!next[index + direction]) return;
        [next[index], next[index + direction]] = [next[index + direction], next[index]];
        next.forEach((dimension, order) => updateDimension({ ...dimension, order }));
    };
    return (
        <>
            {dimensions.map((dimension) => (
                <label className={styles.field} key={dimension.id}>
                    <span className={styles.fieldLabel}>{dimension.name}</span>
                    <select
                        className={styles.source}
                        aria-label={`Preview ${dimension.name}`}
                        value={context[dimension.id]}
                        onChange={(event) =>
                            setPreviewMode({
                                dimensionId: dimension.id,
                                modeId: event.target.value
                            })
                        }
                    >
                        {ordered(dimension.modes).map((mode) => (
                            <option key={mode.id} value={mode.id}>
                                {mode.name}
                            </option>
                        ))}
                    </select>
                </label>
            ))}
            {dimensions.length > 0 && (
                <small className={styles.colorValue}>Your preview only</small>
            )}
            <details className={styles.dimensions}>
                <summary>Dimensions and modes (optional)</summary>
                <p>
                    Variables use a base value until you assign a dimension. Mode overrides
                    currently support colors.
                </p>
                {dimensions.map((dimension, index) => (
                    <div key={dimension.id}>
                        <DimensionEditor dimension={dimension} />
                        <button
                            type="button"
                            disabled={document.locked || index === 0}
                            aria-label={`Move dimension ${dimension.name} up`}
                            onClick={() => move(index, -1)}
                        >
                            ↑
                        </button>
                        <button
                            type="button"
                            disabled={document.locked || index === dimensions.length - 1}
                            aria-label={`Move dimension ${dimension.name} down`}
                            onClick={() => move(index, 1)}
                        >
                            ↓
                        </button>
                    </div>
                ))}
                <form
                    className={styles.field}
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (createDimension(name)) setName('');
                    }}
                >
                    <input
                        aria-label="New dimension name"
                        placeholder="Theme, Brand…"
                        value={name}
                        disabled={document.locked}
                        onChange={(event) => setName(event.target.value)}
                    />
                    <button
                        type="submit"
                        disabled={
                            document.locked ||
                            !name.trim() ||
                            dimensions.some((d) => d.name === name.trim())
                        }
                    >
                        Add dimension
                    </button>
                </form>
            </details>
        </>
    );
}
