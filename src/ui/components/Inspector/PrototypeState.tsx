import React, { useState, type FC } from 'react';
import { useActions } from 'src/app/hooks';
import type { PrototypeBoolean } from 'src/app/types';
import type { PrototypeStateEdit } from 'src/app/interactionEdits';
import styles from './styles.css';

const SHOWN = 'shown';
const HIDDEN = 'hidden';

/** One choice for how an instance starts in the prototype: shown, hidden or following a state. */
export const PrototypeVisibility: FC<{
    instanceId: string;
    visible: boolean;
    stateId?: string;
    values: PrototypeBoolean[];
    blocked: string[];
    disabled: boolean;
}> = ({ instanceId, visible, stateId, values, blocked, disabled }) => {
    const { editInteractions } = useActions();
    const [problem, setProblem] = useState<string>();
    const missing = stateId !== undefined && !values.some((value) => value.id === stateId);
    const choices = values.filter((value) => value.id === stateId || !blocked.includes(value.id));

    return (
        <div className={styles.interactionField}>
            <label htmlFor={`prototype-visibility-${instanceId}`}>In prototype</label>
            <select
                id={`prototype-visibility-${instanceId}`}
                aria-label="Prototype visibility"
                disabled={disabled}
                value={stateId ?? (visible ? SHOWN : HIDDEN)}
                onChange={(event) => {
                    const choice = event.target.value;
                    setProblem(
                        editInteractions({
                            target: 'state',
                            kind: 'bind',
                            instanceId,
                            ...(choice === SHOWN || choice === HIDDEN
                                ? { stateId: null, visible: choice === SHOWN }
                                : { stateId: choice })
                        })
                    );
                }}
            >
                <option value={SHOWN}>Shown at start</option>
                <option value={HIDDEN}>Hidden at start</option>
                {missing && (
                    <option value={stateId}>
                        Missing state, {visible ? 'shown' : 'hidden'} at start
                    </option>
                )}
                {choices.length > 0 && (
                    <optgroup label="Shown while state is true">
                        {choices.map((value) => (
                            <option key={value.id} value={value.id}>
                                Follow {value.name}
                            </option>
                        ))}
                    </optgroup>
                )}
            </select>
            {problem && <p role="alert">{problem}</p>}
        </div>
    );
};

/** The document's named states: shared by every control, so editing them here affects all. */
export const PrototypeState: FC<{ values: PrototypeBoolean[]; disabled: boolean }> = ({
    values,
    disabled
}) => {
    const { editInteractions } = useActions();
    const [name, setName] = useState('');
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
        </details>
    );
};
