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
    onCommit: (text: string) => void;
}> = ({ label, value, type = 'text', id, onCommit }) => {
    const [draft, setDraft] = useState<string>();

    const commit = () => {
        if (draft !== undefined && draft !== value) {
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
            value={draft ?? value}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
        />
    );
};

export const ValueField: FC<{ variable: Variable; variables: Record<string, Variable> }> = ({
    variable,
    variables
}) => {
    const { setVariableValue } = useActions();
    const label = `Value of ${variable.name}`;
    const set = (value: unknown) => setVariableValue({ variableId: variable.id, value });

    switch (variable.type) {
        case 'color':
            return (
                <div className={styles.valueInput}>
                    <SharedOnRelease>
                        <input
                            type="color"
                            aria-label={label}
                            value={variable.values.default}
                            onChange={(event) => set(event.target.value)}
                        />
                    </SharedOnRelease>
                    <DraftField
                        label={`Hex value of ${variable.name}`}
                        value={variable.values.default}
                        onCommit={set}
                    />
                </div>
            );
        case 'number':
            return (
                <DraftField
                    label={label}
                    type="number"
                    value={String(variable.values.default)}
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
                    label={label}
                    value={templateWithNames(variable.values.default, variables)}
                    onCommit={set}
                />
            );
        case 'boolean':
            return (
                <input
                    type="checkbox"
                    aria-label={label}
                    checked={variable.values.default}
                    onChange={(event) => set(event.target.checked)}
                />
            );
    }
};
