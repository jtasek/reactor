import React, { FC, KeyboardEvent, useEffect, useRef, useSyncExternalStore } from 'react';
import { chatFor } from 'src/ai/chat';
import { ContextTooLarge, documentContext } from 'src/ai/context';
import { describeOperation } from 'src/ai/describe';
import { useActions, useCurrentDocument, useSelectedShapesIds } from 'src/app/hooks';
import styles from './styles.css';

const SCROLL_BOTTOM_REACH_PX = 32;
const MAX_PROMPT_LENGTH = 2000;

/** A local chat whose proposed edits reach the document only after Accept. */
export const EditWithWords: FC<{ documentId: string }> = ({ documentId }) => {
    const document = useCurrentDocument();
    const selected = useSelectedShapesIds();
    const { applyOperations, checkOperations, closeAiEdit } = useActions();
    const chat = chatFor(documentId);
    const { draft, turns, problem } = useSyncExternalStore(chat.subscribe, chat.getSnapshot);
    const current = turns.at(-1);
    const pending = current?.status === 'proposing' || current?.status === 'proposed';
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
    useEffect(() => {
        const root = chatRoot.current;
        const keepKeys = (event: globalThis.KeyboardEvent) => {
            event.stopPropagation();
            if (event.key === 'Escape') {
                closeAiEdit();
            }
        };

        root?.addEventListener('keydown', keepKeys);

        return () => root?.removeEventListener('keydown', keepKeys);
    }, [closeAiEdit]);
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

    const ask = () => {
        if (pending || !draft.trim()) {
            return;
        }
        let context: ReturnType<typeof documentContext>;

        try {
            context = documentContext(document);
        } catch (error) {
            if (!(error instanceof ContextTooLarge)) {
                throw error;
            }
            chat.setProblem(error.message);

            return;
        }
        followsBottom.current = true;
        void chat.send({
            context,
            check: (operations) => checkOperations({ documentId, operations })
        });
    };
    const submitOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            ask();
        }
    };
    const accept = () =>
        chat.accept((proposal) =>
            applyOperations({
                documentId,
                by: { kind: 'ai', model: proposal.model, requestId: proposal.requestId },
                operations: proposal.operations
            })
        );

    return (
        <div className={styles.chat} ref={chatRoot} role="group" aria-label="Chat controls">
            <div className={styles.toolbar}>
                <span>Review each change before applying it.</span>
                <button
                    type="button"
                    onClick={() => {
                        chat.clear();
                        followsBottom.current = true;
                        promptField.current?.focus();
                    }}
                >
                    New chat
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
                {turns.length === 0 && (
                    <p className={styles.status}>
                        Describe a change to get a proposal. Your canvas stays editable.
                    </p>
                )}
                {turns.map((turn) => (
                    <article key={turn.id} className={styles.turn}>
                        <p className={styles.userMessage}>
                            <span className={styles.speaker}>You</span>
                            {turn.prompt}
                        </p>
                        <section className={styles.proposal} aria-label="Proposal">
                            <span className={styles.speaker}>AI</span>
                            {turn.messages.map((message, index) => (
                                <p key={index} className={styles.message}>
                                    {message}
                                </p>
                            ))}
                            {turn.operations.length > 0 && (
                                <ol className={styles.operations}>
                                    {turn.operations.map((operation, index) => (
                                        <li key={index}>{describeOperation(operation)}</li>
                                    ))}
                                </ol>
                            )}
                            {turn.status === 'proposing' && (
                                <p className={styles.status}>
                                    {turn.repairing
                                        ? `Fixing a problem: ${turn.repairing}`
                                        : 'Waiting for AI…'}
                                </p>
                            )}
                            {turn.status === 'failed' && (
                                <p className={styles.problem} role="alert">
                                    {turn.problem}
                                </p>
                            )}
                            {turn.status === 'accepted' && (
                                <p className={styles.status}>Applied. You can undo this change.</p>
                            )}
                            {turn.status === 'discarded' && (
                                <p className={styles.status}>Discarded. Nothing changed.</p>
                            )}
                            {turn.status === 'cancelled' && (
                                <p className={styles.status}>Cancelled. Nothing changed.</p>
                            )}
                            {turn.status === 'proposed' && (
                                <div className={styles.actions}>
                                    <button type="button" onClick={chat.discard}>
                                        Discard
                                    </button>
                                    <button type="button" data-variant="primary" onClick={accept}>
                                        Accept
                                    </button>
                                </div>
                            )}
                        </section>
                    </article>
                ))}
            </div>
            <form
                className={styles.form}
                onSubmit={(event) => {
                    event.preventDefault();
                    ask();
                }}
            >
                <p className={styles.status}>
                    {selected.length > 0
                        ? 'Using selected items, their groups and the variables and components they use.'
                        : 'Using this document. Select items first to share a smaller part.'}
                </p>
                {problem && (
                    <p className={styles.problem} role="alert">
                        {problem}
                    </p>
                )}
                <textarea
                    ref={promptField}
                    className={styles.prompt}
                    aria-label="Change to make"
                    placeholder="Describe a change…"
                    value={draft}
                    readOnly={pending}
                    maxLength={MAX_PROMPT_LENGTH}
                    onChange={(event) => chat.setDraft(event.target.value)}
                    onKeyDownCapture={submitOnEnter}
                />
                <div className={styles.actions}>
                    {current?.status === 'proposing' ? (
                        <button
                            type="button"
                            onClick={(event) => {
                                event.preventDefault();
                                chat.stop();
                            }}
                        >
                            Stop
                        </button>
                    ) : (
                        <button
                            type="submit"
                            data-variant="primary"
                            disabled={pending || !draft.trim()}
                        >
                            Send
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
};
