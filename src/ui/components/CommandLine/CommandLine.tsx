import React, { FC, SubmitEvent, useId, useRef, useState } from 'react';
import { SELECTION_HELP, SELECTION_PATTERN } from './selection';
import styles from './styles.css';
import { CREATION_PATTERN, PROPERTY_ALIAS_HELP } from './creation';

interface Suggestion {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
}

export interface Props {
    onSubmit: (command: string) => string | undefined;
    suggestions?: Suggestion[];
    context?: string;
    placement?: string;
    /** Selection edit help for the current selection; without it, help shows once an edit is typed. */
    selectionHelp?: string;
    onClose?: () => void;
    onAskAi?: (text: string) => Promise<string | undefined>;
}

export const CommandLine: FC<Props> = ({
    onSubmit,
    suggestions = [],
    context,
    placement = 'Visible canvas center. Optional x/y override placement.',
    onAskAi,
    onClose,
    selectionHelp
}) => {
    const [value, setValue] = useState('');
    const [message, setMessage] = useState<string>();
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);
    const [creation, setCreation] = useState<string>();
    const [fields, setFields] = useState<Record<string, string>>({});
    const [pending, setPending] = useState(false);
    const listId = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const matches = suggestions
        .filter(({ id, name, description }) =>
            `${id} ${name} ${description}`.toLowerCase().includes(value.toLowerCase().trim())
        )
        .slice(0, 8);
    const listShown = open && matches.length > 0;
    const creating = creation !== undefined || CREATION_PATTERN.test(value.trim());
    const choose = (item: Suggestion) => {
        setValue(item.id);
        const kind = item.id.startsWith('create ') ? item.id.slice(7) : undefined;
        setCreation(kind);
        setFields(
            kind === 'rectangle'
                ? { width: '160', height: '48' }
                : kind === 'circle'
                  ? { radius: '24' }
                  : kind === 'text'
                    ? { value: 'Text', fontSize: '24' }
                    : {}
        );
        setMessage(
            item.enabled
                ? item.description
                : `${item.name} is not available for the current selection.`
        );
        setOpen(false);
        setActive(-1);
    };
    const handleSubmit = (event: SubmitEvent) => {
        event.preventDefault();

        if (pending) {
            return;
        }

        if (open && active >= 0 && matches[active]) {
            choose(matches[active]);

            return;
        }

        const problem = onSubmit(value);
        setMessage(problem);
        setOpen(false);

        if (!problem) {
            setValue('');
            setCreation(undefined);
        }
    };

    return (
        <form className={styles.commandLine} onSubmit={handleSubmit}>
            <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-label="Command"
                aria-expanded={listShown}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={
                    listShown && active >= 0 && matches[active] ? `${listId}-${active}` : undefined
                }
                placeholder="Search commands or create a shape…"
                value={value}
                readOnly={pending}
                onFocus={() => setOpen(creation === undefined)}
                onChange={(event) => {
                    setValue(event.target.value);
                    setCreation(undefined);
                    setMessage(undefined);
                    setOpen(true);
                    setActive(-1);
                }}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                        event.stopPropagation();
                        // A list that is open but empty is not shown, so Escape closes.
                        if (!listShown) {
                            onClose?.();
                        }
                        setOpen(false);
                        setActive(-1);
                    }
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        event.preventDefault();
                        setOpen(true);
                        setActive((index) =>
                            Math.max(
                                0,
                                Math.min(
                                    matches.length - 1,
                                    index + (event.key === 'ArrowDown' ? 1 : -1)
                                )
                            )
                        );
                    }
                }}
            />
            {onClose && (
                <button type="button" onClick={onClose} aria-label="Close Command Line">
                    Close
                </button>
            )}
            {context && <small>{context}</small>}
            {creation && (
                <fieldset>
                    <legend>Create {creation}</legend>
                    {Object.entries(fields).map(([key, value]) => (
                        <label key={key}>
                            {key}
                            <input
                                aria-label={key}
                                value={value}
                                onKeyDown={(event) => {
                                    // Escape in a parameter returns to the command field.
                                    if (event.key === 'Escape') {
                                        event.stopPropagation();
                                        inputRef.current?.focus();
                                    }
                                }}
                                onChange={(event) => {
                                    const next = { ...fields, [key]: event.target.value };
                                    setFields(next);
                                    setValue(
                                        `create ${creation} ${Object.entries(next)
                                            .map(
                                                ([name, entry]) =>
                                                    `${name}=${name === 'value' ? JSON.stringify(entry) : entry}`
                                            )
                                            .join(' ')}`
                                    );
                                }}
                            />
                        </label>
                    ))}
                </fieldset>
            )}
            {listShown && (
                <ul id={listId} role="listbox" aria-label="Commands">
                    {matches.map((item, index) => (
                        <li
                            key={item.id}
                            id={`${listId}-${index}`}
                            role="option"
                            aria-selected={index === active}
                            aria-disabled={!item.enabled}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => choose(item)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    choose(item);
                                }
                            }}
                        >
                            <strong>{item.name}</strong>
                            <span>
                                {item.enabled
                                    ? item.description
                                    : 'Unavailable for the current selection'}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
            {creating && (
                <>
                    <small>
                        Defaults: rectangle 160 × 48 · circle radius 24 · text 24 px. Placement:
                        {placement}
                    </small>
                    <small>{PROPERTY_ALIAS_HELP}</small>
                </>
            )}
            {!creating && (selectionHelp || SELECTION_PATTERN.test(value.trim())) && (
                <small>{selectionHelp ?? SELECTION_HELP}</small>
            )}
            {message && <span role="status">{message}</span>}
            <button type="submit" disabled={pending || !value.trim()}>
                Run
            </button>
            {onAskAi && (
                <button
                    type="button"
                    disabled={pending || !value.trim()}
                    onClick={async () => {
                        setPending(true);
                        try {
                            const problem = await onAskAi(value);
                            setMessage(problem);
                            if (!problem) {
                                setValue('');
                                setCreation(undefined);
                            }
                        } catch {
                            setMessage('Could not open AI chat. Try again.');
                        } finally {
                            setPending(false);
                        }
                    }}
                >
                    Ask AI
                </button>
            )}
        </form>
    );
};
