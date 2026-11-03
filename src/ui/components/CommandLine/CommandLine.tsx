import React, { FC, SubmitEvent, useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Command, Search, Sparkles, X } from 'lucide-react';
import { Icon } from '../Icon';
import { SELECTION_HELP, SELECTION_PATTERN } from './selection';
import styles from './styles.css';
import { CREATION_PATTERN, PROPERTY_ALIAS_HELP } from './creation';
import { editorForAction, editorForInput, editorInput, parameterLabel } from './parameters';
import type { ParameterEditor } from './parameters';

interface Suggestion {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    /** Why the action is unavailable, shown in place of the generic reason. */
    unavailable?: string;
}

const STALE_TARGET = 'Selection changed. Check the target above, then apply again.';

export interface Props {
    onSubmit: (command: string) => string | undefined;
    suggestions?: Suggestion[];
    context?: string;
    targetKey?: string;
    stackContext?: string;
    placement?: string;
    selectionHelp?: string;
    onClose?: () => void;
    onAskAi?: (text: string) => Promise<string | undefined>;
}

export const CommandLine: FC<Props> = ({
    onSubmit,
    suggestions = [],
    context,
    targetKey = context,
    stackContext,
    placement,
    onAskAi,
    onClose,
    selectionHelp
}) => {
    const [value, setValue] = useState('');
    const [message, setMessage] = useState<string>();
    const [open, setOpen] = useState(true);
    const [active, setActive] = useState(-1);
    const [editor, setEditor] = useState<ParameterEditor>();
    const [pending, setPending] = useState(false);
    /** The selection changed under a typed command; the next submit only confirms it. */
    const [staleTarget, setStaleTarget] = useState(false);
    /** The editor was opened from a suggestion, so its fields replace the typed syntax help. */
    const [guided, setGuided] = useState(false);
    const listId = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const priorContext = useRef(targetKey);
    const query = value.trim().toLowerCase();
    const rank = (item: Suggestion) =>
        (item.id.toLowerCase() === query || item.name.toLowerCase() === query
            ? 100
            : item.name.toLowerCase().startsWith(query)
              ? 20
              : 0) + Number(item.enabled);
    const matches = suggestions
        .filter(({ id, name, description }) =>
            `${id} ${name} ${description}`.toLowerCase().includes(query)
        )
        .sort((a, b) => rank(b) - rank(a))
        .slice(0, 8);
    const listShown = open && !editor && matches.length > 0;
    const directInput =
        (CREATION_PATTERN.test(value.trim()) && !/^create\s/i.test(value.trim())) ||
        suggestions.some(
            (item) =>
                (item.id.toLowerCase() === query || item.name.toLowerCase() === query) &&
                !editorForAction(item.id)
        );
    const choosing = listShown && (active >= 0 || !directInput);
    const chosenIndex = Math.max(0, active);
    const creating = editor?.creation || CREATION_PATTERN.test(value.trim());
    const displayContext =
        editor && ('gap' in editor.values || 'padding' in editor.values)
            ? (stackContext ?? context)
            : context;
    const commandName = suggestions.find(
        (item) => item.id.toLowerCase() === query || item.name.toLowerCase() === query
    )?.name;

    useEffect(() => {
        const previous = document.activeElement;
        const form = formRef.current;
        inputRef.current?.focus();

        return () => {
            if (
                previous instanceof HTMLElement &&
                previous.isConnected &&
                (form?.contains(document.activeElement) || document.activeElement === document.body)
            ) {
                previous.focus();
            }
        };
    }, []);

    useEffect(() => {
        if (priorContext.current !== targetKey && value.trim()) {
            setStaleTarget(true);
        }
        priorContext.current = targetKey;
    }, [targetKey, value]);

    useEffect(() => {
        if (active >= 0 && listShown) {
            formRef.current
                ?.querySelector('[aria-selected="true"]')
                ?.scrollIntoView({ block: 'nearest' });
        }
    }, [active, listShown]);

    const back = () => {
        setEditor(undefined);
        setGuided(false);
        setStaleTarget(false);
        setValue('');
        setMessage(undefined);
        setActive(-1);
        setOpen(true);
        inputRef.current?.focus();
    };
    const choose = (item: Suggestion) => {
        if (pending) {
            return;
        }

        if (!item.enabled) {
            setMessage(
                item.unavailable ?? `${item.name} is not available for the current selection.`
            );

            return;
        }
        const next = editorForAction(item.id);
        setEditor(next);
        setGuided(Boolean(next));
        setStaleTarget(false);
        setValue(next ? editorInput(next) : item.id);
        setMessage(undefined);
        setOpen(false);
        setActive(-1);
    };
    const handleSubmit = (event: SubmitEvent) => {
        event.preventDefault();
        if (pending) {
            return;
        }
        if (choosing && matches[chosenIndex]) {
            choose(matches[chosenIndex]);

            return;
        }
        if (!value.trim() || (editor && !editor.creation && !value.includes('='))) {
            setMessage('Enter at least one value. Blank fields stay unchanged.');

            return;
        }
        if (staleTarget) {
            setStaleTarget(false);
            setMessage(STALE_TARGET);

            return;
        }
        const problem = onSubmit(value);
        setMessage(problem);
        setOpen(false);
        if (problem) {
            return;
        }
        if (/ tool$/i.test(value.trim())) {
            onClose?.();

            return;
        }
        setValue('');
        setEditor(undefined);
        setGuided(false);
        setMessage('Command completed.');
        inputRef.current?.focus();
    };

    return (
        <form
            ref={formRef}
            className={styles.commandLine}
            aria-label="Command palette"
            onSubmit={handleSubmit}
            onKeyDownCapture={(event) => {
                if (event.nativeEvent.isComposing) {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                    }

                    return;
                }
                if (event.key === 'Escape') {
                    event.preventDefault();
                    event.stopPropagation();
                    if (editor) {
                        back();

                        return;
                    }
                    onClose?.();
                }
            }}
        >
            <header className={styles.search}>
                <Icon icon={{ component: Search, size: 20 }} />
                <input
                    ref={inputRef}
                    type="text"
                    role="combobox"
                    aria-label="Command"
                    aria-expanded={listShown}
                    aria-controls={listShown ? listId : undefined}
                    aria-autocomplete="list"
                    aria-activedescendant={
                        listShown && matches[chosenIndex] ? `${listId}-${chosenIndex}` : undefined
                    }
                    placeholder="What would you like to do?"
                    value={value}
                    readOnly={pending}
                    onChange={(event) => {
                        setValue(event.target.value);
                        setEditor(editorForInput(event.target.value));
                        setGuided(false);
                        if (!event.target.value.trim()) {
                            setStaleTarget(false);
                        }
                        setMessage(undefined);
                        setOpen(true);
                        setActive(-1);
                    }}
                    onKeyDown={(event) => {
                        if (event.nativeEvent.isComposing) {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                            }

                            return;
                        }
                        if (!editor && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
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
                    <button
                        type="button"
                        disabled={pending}
                        onClick={onClose}
                        aria-label="Close Command Line"
                    >
                        <Icon icon={{ component: X, size: 18 }} />
                    </button>
                )}
            </header>
            {displayContext && <div className={styles.context}>{displayContext}</div>}
            <div className={styles.content}>
                {editor && (
                    <fieldset>
                        <legend>
                            <button
                                type="button"
                                disabled={pending}
                                onClick={back}
                                aria-label="Back to commands"
                            >
                                <Icon icon={{ component: ArrowLeft, size: 16 }} />
                            </button>
                            {editor.title}
                        </legend>
                        <div className={styles.fields}>
                            {Object.entries(editor.values).map(([key, fieldValue]) => (
                                <label key={key}>
                                    {editor.creation && ['x', 'y'].includes(key)
                                        ? key.toUpperCase()
                                        : parameterLabel(key)}
                                    <span aria-hidden="true">
                                        {[
                                            'width',
                                            'height',
                                            'radius',
                                            'x',
                                            'y',
                                            'gap',
                                            'padding',
                                            'fontSize'
                                        ].includes(key)
                                            ? ' · px'
                                            : ''}
                                    </span>
                                    <input
                                        value={fieldValue}
                                        disabled={pending}
                                        placeholder={editor.creation ? undefined : 'Unchanged'}
                                        onChange={(event) => {
                                            const next = {
                                                ...editor,
                                                values: {
                                                    ...editor.values,
                                                    [key]: event.target.value
                                                }
                                            };
                                            setEditor(next);
                                            setValue(editorInput(next));
                                            setMessage(undefined);
                                        }}
                                    />
                                </label>
                            ))}
                        </div>
                        <small>
                            {editor.creation
                                ? placement
                                : 'Only entered values change. Blank fields and their bindings stay unchanged.'}
                        </small>
                    </fieldset>
                )}
                {listShown && (
                    <>
                        <div className={styles.heading}>
                            {query ? 'Matching actions' : 'Suggested actions'}
                        </div>
                        <ul id={listId} role="listbox" aria-label="Commands">
                            {matches.map((item, index) => (
                                <li
                                    key={item.id}
                                    id={`${listId}-${index}`}
                                    role="option"
                                    aria-selected={index === chosenIndex}
                                    aria-disabled={!item.enabled}
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => choose(item)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            choose(item);
                                        }
                                    }}
                                >
                                    <Icon icon={{ component: Command, size: 18 }} />
                                    <div>
                                        <strong>{item.name}</strong>
                                        <span>
                                            {item.enabled
                                                ? item.description
                                                : (item.unavailable ??
                                                  'Unavailable for the current selection')}
                                        </span>
                                    </div>
                                    <Icon icon={{ component: ChevronRight, size: 14 }} />
                                </li>
                            ))}
                        </ul>
                    </>
                )}
                {!editor &&
                    open &&
                    query &&
                    !matches.length &&
                    !SELECTION_PATTERN.test(value.trim()) &&
                    !creating && (
                        <small>
                            No matching action.{' '}
                            {onAskAi
                                ? 'Try a command name, or explicitly ask AI.'
                                : 'Try a command name or an edit such as w=240.'}
                        </small>
                    )}
                {creating && <small>{PROPERTY_ALIAS_HELP}</small>}
                {!creating &&
                    !guided &&
                    (selectionHelp || SELECTION_PATTERN.test(value.trim())) && (
                        <small>{selectionHelp ?? SELECTION_HELP}</small>
                    )}
            </div>
            {(staleTarget || message) && (
                <div role="status" className={styles.message}>
                    {staleTarget ? STALE_TARGET : message}
                </div>
            )}
            <footer className={styles.footer}>
                <small>
                    <kbd>↑</kbd> <kbd>↓</kbd> choose · <kbd>esc</kbd> {editor ? 'back' : 'close'}
                </small>
                <div>
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
                                        setEditor(undefined);
                                        onClose?.();
                                    }
                                } catch {
                                    setMessage('Could not open AI chat. Try again.');
                                } finally {
                                    setPending(false);
                                }
                            }}
                        >
                            <Icon icon={{ component: Sparkles, size: 16 }} />
                            Ask AI
                        </button>
                    )}
                    <button
                        className={styles.primary}
                        type="submit"
                        disabled={pending || (!value.trim() && !choosing)}
                    >
                        {choosing
                            ? 'Choose action'
                            : editor?.creation
                              ? editor.title
                              : editor
                                ? 'Apply changes'
                                : (commandName ?? 'Run command')}{' '}
                        <span aria-hidden="true">↵</span>
                    </button>
                </div>
            </footer>
        </form>
    );
};
