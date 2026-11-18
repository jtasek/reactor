import { ArrowUp, Square } from 'lucide-react';
import React, { FC, KeyboardEvent, ReactNode, RefObject } from 'react';
import type { useChat } from './useChat';
import styles from './styles.css';

/** As the gateway allows: room for pasted CSV or JSON. */
const MAX_PROMPT_LENGTH = 20_000;

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
}> = ({ chat: state, field, onSent, compact, leading, trailing }) => {
    const { chat, draft, problem, current, pending, scope } = state;
    const ask = () => {
        if (state.ask()) {
            onSent?.();
        }
    };
    const submitOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
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
                <textarea
                    ref={field}
                    className={styles.prompt}
                    aria-label="Change to make"
                    placeholder={
                        current?.status === 'proposed'
                            ? 'Accept or discard to continue'
                            : 'Describe a change…'
                    }
                    rows={1}
                    value={draft}
                    readOnly={pending}
                    maxLength={MAX_PROMPT_LENGTH}
                    onChange={(event) => chat.setDraft(event.target.value)}
                    onKeyDownCapture={submitOnEnter}
                />
                <div className={styles.fieldControls}>
                    <span
                        className={styles.chip}
                        data-tinted={!scope.whole || undefined}
                        title={scope.title}
                    >
                        {scope.label}
                    </span>
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
