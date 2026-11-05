import React, { useState, type FC } from 'react';
import { useActions } from 'src/app/hooks';
import type { PrototypeBoolean } from 'src/app/types';
import type { PrototypeStateEdit } from 'src/app/interactionEdits';
import styles from './styles.css';

export const PrototypeState: FC<{
    instanceId: string;
    stateId?: string;
    values: PrototypeBoolean[];
    disabled: boolean;
}> = ({ instanceId, stateId, values, disabled }) => {
    const { editInteractions } = useActions();
    const [name, setName] = useState('');
    const [problem, setProblem] = useState<string>();
    const edit = (change: PrototypeStateEdit) => editInteractions(change);

    return (
        <section aria-label="Prototype state" className={styles.prototypeState}>
            <label className={styles.interactionField}>
                Visibility
                <select
                    aria-label="Visibility state"
                    disabled={disabled}
                    value={stateId ?? ''}
                    onChange={(event) =>
                        setProblem(
                            edit({
                                target: 'state',
                                kind: 'bind',
                                instanceId,
                                stateId: event.target.value || null
                            })
                        )
                    }
                >
                    <option value="">Instance default</option>
                    {stateId && !values.some((value) => value.id === stateId) && (
                        <option value={stateId}>Missing state — uses instance default</option>
                    )}
                    {values.map((value) => (
                        <option key={value.id} value={value.id}>
                            {value.name}
                        </option>
                    ))}
                </select>
            </label>
            <h3>Prototype state</h3>
            <p className={styles.frameHint}>
                Shared by controls in this document. Reset restores these initial values.
            </p>
            {values.map((value) => (
                <div key={value.id} className={styles.prototypeStateRow}>
                    <input
                        type="text"
                        key={value.name}
                        aria-label={`Name of ${value.name}`}
                        defaultValue={value.name}
                        maxLength={100}
                        disabled={disabled}
                        onBlur={(event) => {
                            if (event.target.value === value.name) {
                                return;
                            }
                            setProblem(
                                edit({
                                    target: 'state',
                                    kind: 'update',
                                    id: value.id,
                                    name: event.target.value,
                                    initial: value.initial
                                })
                            );
                        }}
                    />
                    <label>
                        <input
                            type="checkbox"
                            aria-label={`Initial value of ${value.name}`}
                            checked={value.initial}
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
                    const error = edit({ target: 'state', kind: 'add', name, initial: false });
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
                <button type="submit" disabled={disabled || !name.trim()}>
                    Add state
                </button>
            </form>
            {problem && <p role="alert">{problem}</p>}
        </section>
    );
};
