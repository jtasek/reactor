import React, { FC, FormEvent, useState } from 'react';

import styles from './styles.css';

export interface Props {
    /** Runs the typed command; returns a message to show when it could not run. */
    onSubmit: (command: string) => string | undefined;
}

export const CommandLine: FC<Props> = ({ onSubmit }) => {
    const [value, setValue] = useState('');
    const [message, setMessage] = useState<string>();

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();

        const problem = onSubmit(value);

        setMessage(problem);

        // Keep the input after a failure so it can be corrected.
        if (!problem) {
            setValue('');
        }
    };

    return (
        <form className={styles.commandLine} onSubmit={handleSubmit}>
            <input
                type="search"
                aria-label="Command"
                placeholder="type command..."
                value={value}
                onChange={(event) => setValue(event.target.value)}
            />
            {message && <span role="status">{message}</span>}
        </form>
    );
};
