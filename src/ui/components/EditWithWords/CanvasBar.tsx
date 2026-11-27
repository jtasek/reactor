import { PanelRight, Sparkles, X } from 'lucide-react';
import React, { FC, useEffect, useRef, useState } from 'react';
import { useActions } from 'src/app/hooks';
import { Composer } from './Composer';
import { useChatKeys } from './EditWithWords';
import { Reply, type ProposalView } from './Reply';
import { useChat, type ChatPage } from './useChat';
import styles from './styles.css';

const ICON = { size: 16, strokeWidth: 1.75, 'aria-hidden': true } as const;

/** How another page shows the bar: resting at its foot, sharing what the page is about. */
export interface BarPage extends ChatPage {
    placeholder: string;
    /** How the page draws a proposal before Accept. */
    proposal: ProposalView;
    /** Where the bar opens from a button, it closes again. */
    onClose?: () => void;
}

/**
 * The chat as one capsule over the canvas, for a quick change to the selection. The latest
 * reply shows in a card above it; the whole conversation is in the chat panel. Given a
 * `page`, it rests at the foot of that page instead, and Escape puts its reply away.
 */
export const CanvasBar: FC<{ documentId: string; page?: BarPage }> = ({ documentId, page }) => {
    const { closeAiEdit, requestAiEdit } = useActions();
    const chatState = useChat(documentId, page);
    const { chat, pending, local, accept } = chatState;
    const root = useRef<HTMLDivElement>(null);
    const field = useRef<HTMLTextAreaElement>(null);
    const wasPending = useRef(pending);
    // On a page, the latest reply stays until it is put away or another request starts.
    const [hidden, setHidden] = useState<number>();
    const current = chatState.current?.id === hidden ? undefined : chatState.current;
    const settled = current && current.status !== 'proposing' && current.status !== 'proposed';

    useEffect(() => chat.retain(), [chat]);
    useChatKeys(root, () =>
        !page
            ? closeAiEdit()
            : settled
              ? setHidden(current.id)
              : page.onClose && !pending
                ? page.onClose()
                : field.current?.blur()
    );
    // The bar on the canvas, or one opened from a button, takes focus as it opens.
    const opened = !page || Boolean(page.onClose);
    useEffect(() => {
        if (opened) {
            field.current?.focus();
        }
    }, [opened]);
    useEffect(() => {
        if (wasPending.current && !pending) {
            field.current?.focus();
        }
        wasPending.current = pending;
    }, [pending]);

    return (
        <div
            className={page ? `${styles.bar} ${styles.resting}` : styles.bar}
            ref={root}
            role="region"
            aria-label="AI bar"
        >
            {current && (
                <div
                    className={styles.card}
                    role="log"
                    aria-label="AI conversation"
                    aria-live="polite"
                >
                    <div className={styles.barHeader}>
                        <p className={styles.barPrompt} title={current.prompt}>
                            {current.prompt}
                        </p>
                        {page && settled && (
                            <button
                                type="button"
                                className={styles.iconButton}
                                aria-label="Close reply"
                                title="Close (Esc)"
                                onClick={() => setHidden(current.id)}
                            >
                                <X {...ICON} />
                            </button>
                        )}
                    </div>
                    <Reply
                        turn={current}
                        proposal={page?.proposal}
                        onDiscard={chat.discard}
                        onAccept={accept}
                        onExample={
                            local
                                ? (example) => {
                                      chat.setDraft(example);
                                      field.current?.focus();
                                  }
                                : undefined
                        }
                    />
                </div>
            )}
            <Composer
                chat={chatState}
                field={field}
                compact
                placeholder={page?.placeholder}
                leading={
                    <span className={styles.barIcon}>
                        <Sparkles {...ICON} />
                    </span>
                }
                trailing={
                    page?.onClose ? (
                        <button
                            type="button"
                            className={styles.iconButton}
                            aria-label="Close AI bar"
                            title="Close (Esc)"
                            onClick={page.onClose}
                        >
                            <X {...ICON} />
                        </button>
                    ) : (
                        !page && (
                            <>
                                <button
                                    type="button"
                                    className={styles.iconButton}
                                    aria-label="Open in chat panel"
                                    title="Open in chat panel"
                                    onClick={() => requestAiEdit('panel')}
                                >
                                    <PanelRight {...ICON} />
                                </button>
                                <button
                                    type="button"
                                    className={styles.iconButton}
                                    aria-label="Close AI bar"
                                    title="Close (Esc)"
                                    onClick={() => closeAiEdit()}
                                >
                                    <X {...ICON} />
                                </button>
                            </>
                        )
                    )
                }
            />
        </div>
    );
};
