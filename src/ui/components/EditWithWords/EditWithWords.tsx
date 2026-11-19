import { SquarePen } from 'lucide-react';
import React, { FC, useEffect, useRef } from 'react';
import { AI_DISCLOSURE } from 'src/ai/disclosure';
import { useActions } from 'src/app/hooks';
import { Composer } from './Composer';
import { Reply } from './Reply';
import { useChat } from './useChat';
import styles from './styles.css';

const SCROLL_BOTTOM_REACH_PX = 32;
const SUGGESTIONS = [
    'Add a heading “Welcome back”',
    'Make the selection blue',
    'Add 3 circles in a row'
];

/** Keyboard events stay in the chat; Escape closes it. */
export function useChatKeys(root: React.RefObject<HTMLElement | null>, close: () => void) {
    useEffect(() => {
        const node = root.current;
        const keepKeys = (event: globalThis.KeyboardEvent) => {
            event.stopPropagation();
            if (event.key === 'Escape') {
                close();
            }
        };

        node?.addEventListener('keydown', keepKeys);

        return () => node?.removeEventListener('keydown', keepKeys);
    }, [root, close]);
}

/** A local chat whose proposed edits reach the document only after Accept. */
export const EditWithWords: FC<{ documentId: string }> = ({ documentId }) => {
    const { closeAiEdit } = useActions();
    const chatState = useChat(documentId);
    const { chat, turns, pending, local, accept } = chatState;
    const promptField = useRef<HTMLTextAreaElement>(null);
    const chatRoot = useRef<HTMLDivElement>(null);
    const conversation = useRef<HTMLDivElement>(null);
    const followsBottom = useRef(true);
    const wasPending = useRef(pending);

    useEffect(
        () =>
            chat.retain(() => {
                if (window.document.activeElement === window.document.body) {
                    window.document
                        .querySelector<HTMLButtonElement>('button[aria-label="Edit with words"]')
                        ?.focus();
                }
            }),
        [chat]
    );
    useChatKeys(chatRoot, closeAiEdit);
    useEffect(() => {
        // Keyboard docking already focused the panel's header; keep it there.
        if (!window.document.activeElement?.closest('[data-panel="aiEdit"]')) {
            promptField.current?.focus();
        }
    }, []);
    useEffect(() => {
        if (wasPending.current && !pending) {
            promptField.current?.focus();
        }
        wasPending.current = pending;
    }, [pending]);
    useEffect(() => {
        if (followsBottom.current && conversation.current) {
            conversation.current.scrollTop = conversation.current.scrollHeight;
        }
    }, [turns]);

    return (
        <div className={styles.chat} ref={chatRoot} role="group" aria-label="Chat controls">
            <div className={styles.toolbar}>
                {local && (
                    <span className={styles.chip} title={AI_DISCLOSURE.local}>
                        <span className={styles.localDot} aria-hidden="true" />
                        Local test model
                    </span>
                )}
                <button
                    type="button"
                    className={styles.iconButton}
                    aria-label="New chat"
                    title="New chat"
                    disabled={turns.length === 0}
                    onClick={() => {
                        chat.clear();
                        followsBottom.current = true;
                        promptField.current?.focus();
                    }}
                >
                    <SquarePen aria-hidden="true" size={16} strokeWidth={1.75} />
                </button>
            </div>
            <div
                className={styles.conversation}
                role="log"
                aria-label="AI conversation"
                aria-live="polite"
                ref={conversation}
                onScroll={(event) => {
                    const element = event.currentTarget;
                    followsBottom.current =
                        element.scrollHeight - element.scrollTop - element.clientHeight <=
                        SCROLL_BOTTOM_REACH_PX;
                }}
            >
                {turns.length === 0 ? (
                    <div className={styles.empty}>
                        <h3>What should change?</h3>
                        <p>
                            You get a proposal first. Nothing changes until you accept it, and your
                            canvas stays editable.
                        </p>
                        <div className={styles.suggestions}>
                            {SUGGESTIONS.map((suggestion) => (
                                <button
                                    key={suggestion}
                                    type="button"
                                    className={styles.button}
                                    onClick={() => {
                                        chat.setDraft(suggestion);
                                        promptField.current?.focus();
                                    }}
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                        {(local
                            ? [AI_DISCLOSURE.local]
                            : [AI_DISCLOSURE.sent, AI_DISCLOSURE.kept]
                        ).map((text) => (
                            <p key={text} className={styles.disclosure}>
                                {text}
                            </p>
                        ))}
                    </div>
                ) : (
                    turns.map((turn) => (
                        <article key={turn.id} className={styles.turn}>
                            <p className={styles.userMessage}>
                                <span className={styles.visuallyHidden}>You: </span>
                                {turn.prompt}
                            </p>
                            <Reply
                                turn={turn}
                                onDiscard={chat.discard}
                                onAccept={accept}
                                onExample={
                                    local
                                        ? (example) => {
                                              chat.setDraft(example);
                                              promptField.current?.focus();
                                          }
                                        : undefined
                                }
                            />
                        </article>
                    ))
                )}
            </div>
            <Composer
                chat={chatState}
                field={promptField}
                onSent={() => {
                    followsBottom.current = true;
                }}
            />
        </div>
    );
};
