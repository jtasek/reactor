import React, { useRef, useState } from 'react';
import styles from './styles.css';
import type { CompletionVariable } from './completion';

/** Search is local; choosing a result only edits the draft. Apply remains explicit. */
export function VariablePicker({
    variables,
    value,
    disabled,
    onChange
}: {
    variables: CompletionVariable[];
    value: string;
    disabled: boolean;
    onChange: (value: string) => void;
}) {
    const list = useRef<HTMLSelectElement>(null);
    const [query, setQuery] = useState('');
    const matches = variables.filter((variable) =>
        `${variable.name} ${variable.id}`.toLowerCase().includes(query.trim().toLowerCase())
    );
    const nameCounts = new Map<string, number>();
    variables.forEach(({ name }) => nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1));
    const selected = variables.find((variable) => variable.id === value);

    return (
        <div className={styles.variablePicker}>
            <label>
                Search variables
                <input
                    type="search"
                    onKeyDown={(event) => {
                        if (event.nativeEvent.isComposing) {
                            return;
                        }

                        if (event.key === 'Escape' && query) {
                            event.preventDefault();
                            event.stopPropagation();
                            setQuery('');

                            return;
                        }

                        if (event.key === 'Enter' || event.key === 'ArrowDown') {
                            event.preventDefault();
                            list.current?.focus();
                        }
                    }}
                    value={query}
                    disabled={disabled}
                    placeholder="Search by name"
                    onChange={(event) => setQuery(event.target.value)}
                />
            </label>
            <label>
                Variable
                <select
                    ref={list}
                    size={5}
                    value={matches.some((variable) => variable.id === value) ? value : ''}
                    disabled={disabled}
                    onChange={(event) => onChange(event.target.value)}
                >
                    <option value="" disabled>
                        Choose a variable
                    </option>
                    {matches.map((variable) => (
                        <option key={variable.id} value={variable.id}>
                            {variable.name} · {variable.type} · {variable.resolvedValue}
                            {(nameCounts.get(variable.name) ?? 0) > 1 ? ` · ${variable.id}` : ''}
                        </option>
                    ))}
                </select>
            </label>
            {!matches.length && <p role="status">No compatible variables match.</p>}
            {selected && (
                <p role="status">
                    {selected.name}: {selected.resolvedValue} · {selected.provenance}
                </p>
            )}
            <small>Choosing a variable updates the draft. Use Apply to bind it.</small>
        </div>
    );
}
