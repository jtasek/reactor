import React, { useEffect, useRef, useState } from 'react';
import type { Variable, VariableType } from 'src/app/types';
import { useActions, useCurrentDocument } from 'src/app/hooks';
import { isVariableName } from 'src/app/variables';
import { ordered } from 'src/app/variableModes';
import styles from './styles.css';

export const TYPES: { type: VariableType; label: string; value: Variable['values']['default'] }[] =
    [
        { type: 'color', label: 'Color', value: '#000000' },
        { type: 'number', label: 'Number', value: 0 },
        { type: 'text', label: 'Text', value: '' },
        { type: 'boolean', label: 'Boolean', value: false }
    ];

export function CreateVariable({
    onCreated,
    onCancel,
    onDirty
}: {
    onCreated: (id: string) => void;
    onCancel: () => void;
    onDirty: (dirty: boolean) => void;
}) {
    const document = useCurrentDocument();
    const { createVariable, setVariableDimension } = useActions();
    const [name, setName] = useState('');
    const [type, setType] = useState<VariableType>('color');
    const [value, setValue] = useState<string | boolean>('#000000');
    const [dimensionId, setDimensionId] = useState('');
    const [problem, setProblem] = useState('');
    const input = useRef<HTMLInputElement>(null);

    useEffect(() => {
        input.current?.focus();
    }, []);

    return (
        <form
            onChange={() => onDirty(true)}
            onSubmit={(event) => {
                event.preventDefault();
                if (document.locked) {
                    return;
                }
                const wanted = name.trim();
                if (!isVariableName(wanted)) {
                    setProblem('A name cannot be blank or hold {, } or $.');

                    return;
                }
                const id = createVariable({
                    name: wanted,
                    type,
                    value: type === 'number' ? Number(value) : value
                });
                if (!id) {
                    setProblem(`A variable is already named ${wanted}.`);

                    return;
                }
                if (dimensionId && type !== 'boolean') {
                    setVariableDimension({ variableId: id, dimensionId });
                }
                onDirty(false);
                onCreated(id);
            }}
        >
            <fieldset disabled={document.locked} className={styles.editorFields}>
                <h3>New variable</h3>
                <p className={styles.resolution}>Create a value you can reuse in your designs.</p>
                <label className={styles.formField}>
                    Name
                    <input
                        ref={input}
                        type="text"
                        aria-label="New variable name"
                        placeholder="brand/primary"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                    />
                </label>
                <label className={styles.formField}>
                    Type
                    <select
                        aria-label="New variable type"
                        value={type}
                        onChange={(event) => {
                            const next = TYPES.find((item) => item.type === event.target.value);
                            if (!next) {
                                return;
                            }
                            setType(next.type);
                            setValue(next.type === 'boolean' ? false : String(next.value));
                        }}
                    >
                        {TYPES.map((item) => (
                            <option key={item.type} value={item.type}>
                                {item.label}
                            </option>
                        ))}
                    </select>
                </label>
                <label className={styles.formField}>
                    Base value
                    {type === 'boolean' ? (
                        <input
                            type="checkbox"
                            aria-label="New variable value"
                            checked={Boolean(value)}
                            onChange={(event) => setValue(event.target.checked)}
                        />
                    ) : (
                        <input
                            type={
                                type === 'color' ? 'color' : type === 'number' ? 'number' : 'text'
                            }
                            step={type === 'number' ? 'any' : undefined}
                            required={type === 'number'}
                            aria-label="New variable value"
                            value={String(value)}
                            onChange={(event) => setValue(event.target.value)}
                        />
                    )}
                </label>
                {type !== 'boolean' && Object.keys(document.dimensions).length > 0 && (
                    <details>
                        <summary>Add mode values · Optional</summary>
                        <label className={styles.formField}>
                            Vary by
                            <select
                                aria-label="New variable dimension"
                                value={dimensionId}
                                onChange={(event) => setDimensionId(event.target.value)}
                            >
                                <option value="">None — base value only</option>
                                {ordered(document.dimensions).map((dimension) => (
                                    <option key={dimension.id} value={dimension.id}>
                                        {dimension.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </details>
                )}
                {problem && (
                    <p className={styles.problem} role="alert">
                        {problem}
                    </p>
                )}
                <div className={styles.formActions}>
                    <button type="button" onClick={onCancel}>
                        Cancel
                    </button>
                    <button type="submit" className={styles.primary}>
                        Create variable
                    </button>
                </div>
            </fieldset>
        </form>
    );
}
