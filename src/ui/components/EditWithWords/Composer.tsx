import { ArrowUp, Square } from 'lucide-react';
import React, { FC, KeyboardEvent, ReactNode, RefObject, useEffect, useId, useState } from 'react';
import type { complete } from 'src/ai/local/complete';
import type { Context } from 'src/ai/local/interpret';
import { useCurrentDocument, useSelectedShapesIds } from 'src/app/hooks';
import type { useChat } from './useChat';
import styles from './styles.css';

/** As the gateway allows: room for pasted CSV or JSON. */
const MAX_PROMPT_LENGTH = 20_000;

/**
 * What finishes the sentence being typed for the local test model, which is loaded
 * with it; nothing for the server's AI, which takes any words.
 */
function useCompletion(local: boolean, draft: string) {
    const document = useCurrentDocument();
    const selection = useSelectedShapesIds();
    const [finish, setFinish] = useState<typeof complete>();

    useEffect(() => {
        if (local) {
            void import('src/ai/local/complete').then((loaded) => setFinish(() => loaded.complete));
        }
    }, [local]);

    return local && finish
        ? finish(draft, { selection, shapes: document.shapes as unknown as Context['shapes'] })
        : '';
}

/** The prompt: what it shares, the field, and one round button that sends or stops. */
export const Composer: FC<{
    chat: ReturnType<typeof useChat>;
    field: RefObject<HTMLTextAreaElement | null>;
    onSent?: () => void;
    /** The canvas bar's one-line field, which grows only as the words wrap. */
    compact?: boolean;
    /** Controls drawn in the field, before its text and before the send button. */
    leading?: ReactNode;
    trailing?: ReactNode;
    placeholder?: string;
}> = ({ chat: state, field, onSent, compact, leading, trailing, placeholder }) => {
    const { chat, draft, problem, current, pending, scope } = state;
    const ask = () => {
        if (state.ask()) {
            onSent?.();
        }
    };
    const rest = useCompletion(state.local && !pending, draft);
    const hint = useId();
    const submitOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Tab' && rest && !event.shiftKey) {
            event.preventDefault();
            chat.setDraft(draft + rest);
        } else if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            ask();
        }
    };

    return (
        <form
            className={styles.form}
            data-compact={compact || undefined}
            onSubmit={(event) => {
                event.preventDefault();
                ask();
            }}
        >
            {problem && (
                <p className={styles.problem} role="alert">
                    {problem}
                </p>
            )}
            <div className={styles.field}>
                {leading}
                <div className={styles.promptBox}>
                    <textarea
                        ref={field}
                        className={styles.prompt}
                        aria-label="Change to make"
                        placeholder={
                            current?.status === 'proposed'
                                ? 'Accept or discard to continue'
                                : (placeholder ?? 'Describe a change…')
                        }
                        rows={1}
                        value={draft}
                        readOnly={pending}
                        maxLength={MAX_PROMPT_LENGTH}
                        onChange={(event) => chat.setDraft(event.target.value)}
                        onKeyDownCapture={submitOnEnter}
                        aria-describedby={rest ? hint : undefined}
                    />
                    {rest && (
                        <div className={styles.ghost} aria-hidden="true">
                            <span>{draft}</span>
                            {rest}
                        </div>
                    )}
                </div>
                <div className={styles.fieldControls}>
                    <span
                        className={styles.chip}
                        data-tinted={!scope.whole || undefined}
                        title={scope.title}
                    >
                        {scope.label}
                    </span>
                    {rest && (
                        // Read out with the field: the grey words are only seen.
                        <span id={hint} className={compact ? styles.visuallyHidden : styles.hint}>
                            Tab to complete
                            <span className={styles.visuallyHidden}>: {draft + rest}</span>
                        </span>
                    )}
                    {trailing}
                    {current?.status === 'proposing' ? (
                        <button
                            type="button"
                            className={styles.send}
                            data-stop
                            aria-label="Stop"
                            title="Stop"
                            onClick={(event) => {
                                event.preventDefault();
                                chat.stop();
                            }}
                        >
                            <Square
                                aria-hidden="true"
                                size={10}
                                fill="currentColor"
                                strokeWidth={0}
                            />
                        </button>
                    ) : (
                        <button
                            type="submit"
                            className={styles.send}
                            aria-label="Send"
                            title="Send"
                            disabled={pending || !draft.trim()}
                        >
                            <ArrowUp aria-hidden="true" size={16} strokeWidth={2.25} />
                        </button>
                    )}
                </div>
            </div>
        </form>
    );
};
