import React, { FC, KeyboardEvent, useState } from 'react';
import type { Variable } from 'src/app/types';
import { useActions } from 'src/app/hooks';
import { templateWithNames } from 'src/app/variables';
import { SharedOnRelease } from '../Inspector/SharedOnRelease';
import styles from './styles.css';
/**
 * A text or number field whose typing is a draft: applied on Enter or blur, dropped
 * on Escape. It then shows `value` again, so a rejected change does not linger.
 */
export const DraftField: FC<{
    label: string;
    value: string;
    type?: 'text' | 'number';
    id?: string;
    describedBy?: string;
    /** Typing an inherited mode value makes it independent even if it matches the default. */
    commitUnchanged?: boolean;
    onCommit: (text: string) => void;
}> = ({ label, value, type = 'text', id, describedBy, commitUnchanged = false, onCommit }) => {
    const [draft, setDraft] = useState<string>();

    const commit = () => {
        if (draft !== undefined && (commitUnchanged || draft !== value)) {
            onCommit(draft);
        }

        setDraft(undefined);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.nativeEvent.isComposing) {
            return;
        }

        if (event.key === 'Enter') {
            commit();
        }

        if (event.key === 'Escape') {
            setDraft(undefined);
        }
    };

    return (
        <input
            id={id}
            type={type}
            step={type === 'number' ? 'any' : undefined}
            aria-label={label}
            aria-describedby={describedBy}
            value={draft ?? value}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
        />
    );
};

export const ValueField: FC<{
    variable: Variable;
    variables: Record<string, Variable>;
    mode?: { id: string; name: string };
    /** An element naming the row, such as the default mode's name. */
    describedBy?: string;
}> = ({ variable, variables, mode, describedBy }) => {
    const { setVariableValue, setVariableModeValue } = useActions();
    const label = mode ? `${mode.name} value of ${variable.name}` : `Value of ${variable.name}`;
    const id = `${variable.id}-${mode?.id ?? 'default'}`;
    const value =
        variable.type !== 'boolean' && mode
            ? (variable.values[mode.id] ?? variable.values.default)
            : variable.values.default;
    // Only an inherited row commits a retyped equal value, which makes it independent.
    const inherited =
        mode !== undefined && variable.type !== 'boolean' && variable.values[mode.id] === undefined;
    const set = (value: string | number | boolean) => {
        if (mode && typeof value !== 'boolean') {
            setVariableModeValue({ variableId: variable.id, modeId: mode.id, value });

            return;
        }
        setVariableValue({ variableId: variable.id, value });
    };

    switch (variable.type) {
        case 'color':
            return (
                <div className={styles.valueInput}>
                    <SharedOnRelease>
                        <input
                            id={id}
                            type="color"
                            aria-label={label}
                            aria-describedby={describedBy}
                            value={String(value)}
                            onChange={(event) => set(event.target.value)}
                        />
                    </SharedOnRelease>
                    <DraftField
                        label={
                            mode
                                ? `${mode.name} hex value of ${variable.name}`
                                : `Hex value of ${variable.name}`
                        }
                        value={String(value)}
                        commitUnchanged={inherited}
                        describedBy={describedBy}
                        onCommit={set}
                    />
                </div>
            );
        case 'number':
            return (
                <DraftField
                    id={id}
                    label={label}
                    type="number"
                    value={String(value)}
                    commitUnchanged={inherited}
                    describedBy={describedBy}
                    onCommit={(text) => {
                        if (text.trim() !== '') {
                            set(Number(text));
                        }
                    }}
                />
            );
        case 'text':
            return (
                <DraftField
                    id={id}
                    label={label}
                    value={templateWithNames(String(value), variables)}
                    commitUnchanged={inherited}
                    describedBy={describedBy}
                    onCommit={set}
                />
            );
        case 'boolean':
            return (
                <input
                    id={id}
                    type="checkbox"
                    aria-label={label}
                    aria-describedby={describedBy}
                    checked={variable.values.default}
                    onChange={(event) => set(event.target.checked)}
                />
            );
    }
};
