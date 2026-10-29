import React, { useEffect, useRef, useState } from 'react';
import { json } from 'overmind';
import { ActionsMenu } from './ActionsMenu';
import { useActions, useCurrentDocument, useEffects, useVariableContext } from 'src/app/hooks';
import { ordered, readDimension } from 'src/app/variableModes';
import type { VariableDimension } from 'src/app/types';
import styles from './styles.css';

export function ModePreview() {
    const document = useCurrentDocument();
    const context = useVariableContext();
    const { setPreviewMode } = useActions();
    const dimensions = ordered(document.dimensions);

    if (!dimensions.length) {
        return null;
    }

    return (
        <details className={styles.secondary}>
            <summary>Canvas preview</summary>
            <p className={styles.resolution}>
                Your preview only. Screen view settings stay unchanged.
            </p>
            {dimensions.map((dimension) => (
                <label className={styles.field} key={dimension.id}>
                    <span className={styles.fieldLabel}>{dimension.name}</span>
                    <select
                        className={styles.source}
                        aria-label={`Preview ${dimension.name}`}
                        value={context[dimension.id] ?? dimension.defaultModeId}
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
        </details>
    );
}

const MAX_MODES = 100;

export function DimensionEditor({
    dimension,
    onSaved,
    onCancel,
    onDirty
}: {
    dimension?: VariableDimension;
    onSaved: (id: string) => void;
    onCancel: () => void;
    onDirty: (dirty: boolean) => void;
}) {
    const document = useCurrentDocument();
    const { newId } = useEffects();
    const { createDimension, updateDimension, deleteDimensionMode, deleteDimension } = useActions();
    const [original] = useState(() => (dimension ? JSON.stringify(json(dimension)) : ''));
    const [draft, setDraft] = useState<VariableDimension>(() => {
        if (dimension) {
            return structuredClone(json(dimension));
        }
        const id = newId();
        const modeId = newId();

        return {
            id,
            name: '',
            order: Object.keys(document.dimensions).length,
            defaultModeId: modeId,
            modes: { [modeId]: { id: modeId, name: 'Default', order: 0 } }
        };
    });
    const [problem, setProblem] = useState('');
    const [deleting, setDeleting] = useState<string>();
    const nameInput = useRef<HTMLInputElement>(null);
    // Traverse the tracked proxy so remote changes to any field invalidate the draft.
    const changedElsewhere = Boolean(dimension && original !== JSON.stringify(dimension));
    const dirty = original !== JSON.stringify(draft);
    const modes = ordered(draft.modes);

    useEffect(() => {
        if (!dimension) {
            nameInput.current?.focus();
        }
    }, [dimension]);

    const change = (next: VariableDimension) => {
        setDraft(next);
        setProblem('');
        setDeleting(undefined);
        onDirty(original !== JSON.stringify(next));
    };
    const removeUnsavedMode = (id: string) => {
        if (dimension?.modes[id] || modes.length === 1) {
            return;
        }
        const remaining = modes.filter((mode) => mode.id !== id);
        const fallback =
            remaining.find((mode) => mode.id === dimension?.defaultModeId) ?? remaining[0];
        change({
            ...draft,
            modes: Object.fromEntries(remaining.map((mode) => [mode.id, mode])),
            defaultModeId: draft.defaultModeId === id ? fallback.id : draft.defaultModeId
        });
    };
    const move = (id: string, direction: number) => {
        const index = modes.findIndex((mode) => mode.id === id);
        const next = [...modes];
        const other = next[index + direction];
        if (!other) {
            return;
        }
        [next[index], next[index + direction]] = [other, next[index]];
        change({
            ...draft,
            modes: Object.fromEntries(next.map((mode, order) => [mode.id, { ...mode, order }]))
        });
    };
    const save = () => {
        if (document.locked || changedElsewhere) {
            return;
        }
        try {
            const validated = readDimension(draft);
            if (
                Object.values(document.dimensions).some(
                    (item) => item.id !== dimension?.id && item.name === validated.name
                )
            ) {
                setProblem('A dimension already has this name.');

                return;
            }
            const id = dimension?.id ?? createDimension(validated.name);
            if (!id) {
                setProblem('The dimension could not be created.');

                return;
            }
            updateDimension({ ...validated, id });
            onDirty(false);
            onSaved(id);
        } catch (error) {
            setProblem(
                error instanceof Error ? error.message : 'Check the dimension and mode names.'
            );
        }
    };
    const remove = () => {
        if (document.locked || changedElsewhere || dirty || !dimension || !deleting) {
            return;
        }
        if (deleting === dimension.id) {
            deleteDimension(dimension.id);
            onDirty(false);
            onCancel();

            return;
        }
        deleteDimensionMode({ dimensionId: dimension.id, modeId: deleting });
        onDirty(false);
        onSaved(dimension.id);
    };

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                save();
            }}
        >
            <fieldset disabled={document.locked} className={styles.editorFields}>
                {!dimension && <h3>New dimension</h3>}
                {changedElsewhere && (
                    <div className={styles.notice} role="alert">
                        This dimension changed elsewhere. Reload it before saving to keep those
                        changes.
                        <button
                            type="button"
                            onClick={() => {
                                onDirty(false);
                                onSaved(draft.id);
                            }}
                        >
                            Reload dimension
                        </button>
                    </div>
                )}
                <div className={styles.rowHeader}>
                    <label className={styles.formField}>
                        Name
                        <input
                            ref={nameInput}
                            aria-label={
                                dimension
                                    ? `Name of dimension ${dimension.name}`
                                    : 'New dimension name'
                            }
                            value={draft.name}
                            maxLength={200}
                            required
                            onChange={(event) => change({ ...draft, name: event.target.value })}
                        />
                    </label>
                    {dimension && (
                        <ActionsMenu label="Dimension actions">
                            {dirty && (
                                <p className={styles.resolution}>
                                    Save changes to reorder or delete.
                                </p>
                            )}
                            {[-1, 1].map((direction) => {
                                const dimensions = ordered(document.dimensions);
                                const index = dimensions.findIndex(
                                    (item) => item.id === dimension.id
                                );
                                const other = dimensions[index + direction];

                                return (
                                    <button
                                        key={direction}
                                        type="button"
                                        aria-label={`Move dimension ${dimension.name} ${direction < 0 ? 'up' : 'down'}`}
                                        disabled={dirty || changedElsewhere || !other}
                                        onClick={() => {
                                            [dimensions[index], dimensions[index + direction]] = [
                                                other,
                                                dimension
                                            ];
                                            dimensions.forEach((item, order) =>
                                                updateDimension({ ...json(item), order })
                                            );
                                            onSaved(dimension.id);
                                        }}
                                    >
                                        Move {direction < 0 ? 'up' : 'down'}
                                    </button>
                                );
                            })}
                            <button
                                type="button"
                                disabled={dirty || changedElsewhere}
                                onClick={() => setDeleting(dimension.id)}
                            >
                                Delete dimension
                            </button>
                        </ActionsMenu>
                    )}
                </div>
                {dimension ? (
                    <div className={styles.metadata}>
                        <span>Dimension</span>
                        <span>
                            {modes.length} {modes.length === 1 ? 'mode' : 'modes'}
                        </span>
                    </div>
                ) : (
                    <p className={styles.resolution}>
                        A dimension groups modes, such as Theme: Light and Dark.
                    </p>
                )}
                <div className={styles.section}>
                    <div className={styles.sectionHeading}>
                        <h4>Modes</h4>
                        <button
                            type="button"
                            disabled={modes.length >= MAX_MODES}
                            onClick={() => {
                                const id = newId();
                                change({
                                    ...draft,
                                    modes: {
                                        ...draft.modes,
                                        [id]: { id, name: '', order: modes.length }
                                    }
                                });
                            }}
                        >
                            Add mode
                        </button>
                    </div>
                    <p className={styles.resolution}>
                        The default mode uses each variable’s base value.
                    </p>
                    {modes.map((mode, index) => (
                        <div className={styles.modeEdit} key={mode.id}>
                            <input
                                aria-label={`Name of mode ${dimension?.modes[mode.id]?.name ?? mode.name} in ${dimension?.name ?? 'new dimension'}`}
                                value={mode.name}
                                placeholder="Mode name"
                                required
                                maxLength={200}
                                onChange={(event) =>
                                    change({
                                        ...draft,
                                        modes: {
                                            ...draft.modes,
                                            [mode.id]: { ...mode, name: event.target.value }
                                        }
                                    })
                                }
                            />
                            <label className={styles.defaultChoice}>
                                <input
                                    type="radio"
                                    name={`default-${draft.id}`}
                                    aria-label={`Use ${mode.name} as default`}
                                    checked={draft.defaultModeId === mode.id}
                                    onChange={() => change({ ...draft, defaultModeId: mode.id })}
                                />{' '}
                                Default
                            </label>
                            <ActionsMenu label={`Actions for mode ${mode.name}`}>
                                <button
                                    type="button"
                                    aria-label={`Move ${mode.name} up`}
                                    disabled={index === 0}
                                    onClick={() => move(mode.id, -1)}
                                >
                                    Move up
                                </button>
                                <button
                                    type="button"
                                    aria-label={`Move ${mode.name} down`}
                                    disabled={index === modes.length - 1}
                                    onClick={() => move(mode.id, 1)}
                                >
                                    Move down
                                </button>
                                {dimension?.modes[mode.id] ? (
                                    <button
                                        type="button"
                                        disabled={dirty || modes.length === 1 || changedElsewhere}
                                        onClick={() => setDeleting(mode.id)}
                                    >
                                        Delete mode {mode.name}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        disabled={modes.length === 1}
                                        onClick={() => removeUnsavedMode(mode.id)}
                                    >
                                        Remove unsaved mode {mode.name}
                                    </button>
                                )}
                            </ActionsMenu>
                        </div>
                    ))}
                </div>
                {problem && (
                    <p className={styles.problem} role="alert">
                        {problem}
                    </p>
                )}
                {deleting && (
                    <div role="group" aria-label="Confirm deletion" className={styles.notice}>
                        <p>
                            {deleting === dimension?.id
                                ? 'Delete this dimension and its mode values? Base values remain.'
                                : 'Delete this mode and its values? The remaining modes keep their values.'}
                        </p>
                        <div className={styles.actions}>
                            <button type="button" onClick={() => setDeleting(undefined)}>
                                Keep
                            </button>
                            <button type="button" onClick={remove}>
                                Delete
                            </button>
                        </div>
                    </div>
                )}
                <div className={styles.formActions}>
                    <button type="button" onClick={onCancel}>
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className={styles.primary}
                        disabled={changedElsewhere || Boolean(dimension && !dirty)}
                    >
                        {dimension ? 'Save changes' : 'Create dimension'}
                    </button>
                </div>
            </fieldset>
        </form>
    );
}
