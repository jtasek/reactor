import React, { FC, SubmitEvent, useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Command, Search, Sparkles, X, Repeat2 } from 'lucide-react';
import { Icon } from '../Icon';
import { shortcutKeys, shortcutLabel, usesCommandKey } from '../CommandBar/shortcutLabel';
import { SELECTION_HELP, SELECTION_PATTERN } from './selection';
import styles from './styles.css';
import { CREATION_PATTERN, PROPERTY_ALIAS_HELP } from './creation';
import { editorForAction, editorForInput, editorInput, parameterLabel } from './parameters';
import type { ParameterEditor } from './parameters';

import { submitCandidate } from './search';
import type { Suggestion } from './search';
import { useCommandSearch } from './useCommandSearch';
import { recentCommands, rememberCommand, clearRecentCommands, recentSuggestion } from './history';

const STALE_TARGET = 'Selection changed. Check the target above, then apply again.';

export interface Props {
    bindingProperties?: { key: string; label: string; kind: string }[];
    variables?: { id: string; name: string; type: string }[];
    historyKey: string;
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
    bindingProperties = [],
    variables = [],
    historyKey,
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
    const [history, setHistory] = useState(() => ({
        documentId: historyKey,
        commands: recentCommands(historyKey)
    }));
    const recent =
        history.documentId === historyKey ? history.commands : recentCommands(historyKey);
    const setRecent = (commands: string[]) => setHistory({ documentId: historyKey, commands });
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
    const focusParameters = useRef(false);
    const query = value.trim().toLowerCase();
    const mac = usesCommandKey();
    const showingRecent = !query && recent.length > 0;
    const recentItems = recent.map((input) => recentSuggestion(input, suggestions, variables));
    const search = useCommandSearch(
        suggestions,
        query,
        open && !editor && !showingRecent && !value.includes('=')
    );
    const matches = showingRecent ? recentItems : search.matches;
    const waiting = search.waiting;
    const resolve = showingRecent ? () => recentItems : search.resolve;
    const listShown = open && !editor && matches.length > 0;
    const directInput =
        (CREATION_PATTERN.test(value.trim()) && !/^create\s/i.test(value.trim())) ||
        suggestions.some(
            (item) =>
                (item.id.toLowerCase() === query || item.name.toLowerCase() === query) &&
                !editorForAction(item.id)
        );
    const choosing = listShown && (active >= 0 || !directInput);
    const chosenIndex = Math.max(0, Math.min(active, matches.length - 1));
    const creating = editor?.creation || CREATION_PATTERN.test(value.trim());
    const displayContext =
        editor &&
        ('gap' in editor.values ||
            'padding' in editor.values ||
            ['gap', 'padding'].includes(editor.values.property))
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

    useEffect(() => {
        if (!focusParameters.current || !editor) {
            return;
        }

        focusParameters.current = false;
        const field = formRef.current?.querySelector<HTMLInputElement | HTMLSelectElement>(
            'fieldset input, fieldset select'
        );
        field?.focus();
        if (field instanceof HTMLInputElement) {
            field.select();
        }
    }, [editor]);

    const changeParameter = (key: string, value: string) => {
        if (!editor) {
            return;
        }
        const next = { ...editor, values: { ...editor.values, [key]: value } };
        if (key === 'property' && 'variable' in next.values) {
            next.values.variable = '';
        }
        setEditor(next);
        setValue(editorInput(next));
        setMessage(undefined);
    };
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
        const next =
            item.input !== undefined ? editorForInput(item.input) : editorForAction(item.id);
        focusParameters.current = Boolean(next);
        setEditor(next);
        setGuided(Boolean(next) && item.input === undefined);
        setStaleTarget(false);
        setValue(item.input ?? (next ? editorInput(next) : item.id));
        setMessage(undefined);
        setOpen(false);
        setActive(-1);
    };
    const handleSubmit = (event: SubmitEvent) => {
        event.preventDefault();
        if (pending) {
            return;
        }
        const candidate = submitCandidate({
            waiting,
            directInput,
            choosing,
            matches,
            chosenIndex,
            resolve
        });
        if (candidate) {
            choose(candidate);

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
        execute(value);
    };
    const execute = (input: string) => {
        const problem = onSubmit(input);
        setMessage(problem);
        setOpen(false);
        if (problem) {
            return;
        }
        setRecent(rememberCommand(historyKey, input));
        if (/ tool$/i.test(input.trim())) {
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
                        if (pending || editor || !['ArrowDown', 'ArrowUp'].includes(event.key)) {
                            return;
                        }

                        event.preventDefault();
                        const options = listShown ? matches : resolve();
                        const current = listShown ? chosenIndex : -1;
                        const next =
                            event.key === 'ArrowDown'
                                ? Math.min(current + 1, options.length - 1)
                                : Math.max(current < 0 ? options.length - 1 : current - 1, 0);
                        setOpen(true);
                        setActive(next);
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
            <div className={styles.content} aria-busy={waiting}>
                {/* Not a live region: it would be announced on every keystroke; aria-busy covers it. */}
                {waiting && <small>Searching commands…</small>}
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
                                    {guided && ['property', 'variable'].includes(key) ? (
                                        <select
                                            value={fieldValue}
                                            disabled={pending}
                                            onChange={(event) =>
                                                changeParameter(key, event.target.value)
                                            }
                                        >
                                            <option value="">Choose {key}</option>
                                            {key === 'property'
                                                ? bindingProperties.map((property) => (
                                                      <option
                                                          key={property.key}
                                                          value={property.key}
                                                      >
                                                          {property.label}
                                                      </option>
                                                  ))
                                                : variables
                                                      .filter(
                                                          (variable) =>
                                                              variable.type ===
                                                              bindingProperties.find(
                                                                  (property) =>
                                                                      property.key ===
                                                                      editor.values.property
                                                              )?.kind
                                                      )
                                                      .map((variable) => (
                                                          <option
                                                              key={variable.id}
                                                              value={variable.id}
                                                          >
                                                              {variable.name} · {variable.type}
                                                          </option>
                                                      ))}
                                        </select>
                                    ) : (
                                        <input
                                            value={fieldValue}
                                            disabled={pending}
                                            placeholder={editor.creation ? undefined : 'Unchanged'}
                                            onChange={(event) =>
                                                changeParameter(key, event.target.value)
                                            }
                                        />
                                    )}
                                </label>
                            ))}
                        </div>
                        <small>
                            {editor.creation
                                ? placement
                                : editor.prefix === 'bind'
                                  ? 'Choose a property and a compatible variable. Its modes are inherited automatically.'
                                  : editor.prefix === 'unbind'
                                    ? 'The stored base value stays; this property stops following its variable.'
                                    : 'Only entered values change. Blank fields and their bindings stay unchanged.'}
                        </small>
                    </fieldset>
                )}
                {listShown && (
                    <>
                        <div className={styles.heading}>
                            <span>
                                {query
                                    ? 'Matching actions'
                                    : showingRecent
                                      ? 'Recent commands'
                                      : 'Suggested actions'}
                            </span>
                            {showingRecent && (
                                <button
                                    type="button"
                                    disabled={pending}
                                    onClick={() => {
                                        clearRecentCommands(historyKey);
                                        setRecent([]);
                                        setActive(-1);
                                    }}
                                >
                                    Clear recent commands
                                </button>
                            )}
                        </div>
                        <ul id={listId} role="listbox" aria-label="Commands">
                            {matches.map((item, index) => (
                                <li
                                    key={item.id}
                                    id={`${listId}-${index}`}
                                    role="option"
                                    aria-selected={index === chosenIndex}
                                    aria-disabled={!item.enabled}
                                    aria-keyshortcuts={
                                        item.shortcut ? shortcutKeys(item.shortcut, mac) : undefined
                                    }
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => choose(item)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            choose(item);
                                        }
                                    }}
                                >
                                    {/* Tool metadata may color an icon; rows use the palette's ink. */}
                                    <Icon
                                        icon={{
                                            component: item.icon?.component ?? Command,
                                            size: 18
                                        }}
                                    />
                                    <div>
                                        <strong>{item.name}</strong>
                                        <span>
                                            {item.enabled
                                                ? item.description
                                                : (item.unavailable ??
                                                  'Unavailable for the current selection')}
                                        </span>
                                    </div>
                                    {item.shortcut && (
                                        // Announced through the option's aria-keyshortcuts.
                                        <kbd title="Canvas shortcut" aria-hidden="true">
                                            {shortcutLabel(item.shortcut, mac)}
                                        </kbd>
                                    )}
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
                    !waiting &&
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
                    {!query && !editor && recentItems[0] && (
                        <button
                            type="button"
                            disabled={pending || !recentItems[0].enabled}
                            title={`Repeat on current selection: ${recent[0]}`}
                            onClick={() => {
                                setStaleTarget(false);
                                setValue(recent[0]);
                                setEditor(editorForInput(recent[0]));
                                execute(recent[0]);
                            }}
                        >
                            <Icon icon={{ component: Repeat2, size: 16 }} />
                            Repeat last command
                        </button>
                    )}
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
                        {choosing || waiting
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
