import { PanelRight, Sparkles, X } from 'lucide-react';
import React, { FC, useEffect, useRef } from 'react';
import { useActions } from 'src/app/hooks';
import { Composer } from './Composer';
import { useChatKeys } from './EditWithWords';
import { Reply } from './Reply';
import { useChat } from './useChat';
import styles from './styles.css';

const ICON = { size: 16, strokeWidth: 1.75, 'aria-hidden': true } as const;

/**
 * The chat as one capsule over the canvas, for a quick change to the selection. The latest
 * reply shows in a card above it; the whole conversation is in the chat panel.
 */
export const CanvasBar: FC<{ documentId: string }> = ({ documentId }) => {
    const { closeAiEdit, requestAiEdit } = useActions();
    const chatState = useChat(documentId);
    const { chat, current, pending, accept } = chatState;
    const root = useRef<HTMLDivElement>(null);
    const field = useRef<HTMLTextAreaElement>(null);
    const wasPending = useRef(pending);

    useEffect(() => chat.retain(), [chat]);
    useChatKeys(root, closeAiEdit);
    useEffect(() => field.current?.focus(), []);
    useEffect(() => {
        if (wasPending.current && !pending) {
            field.current?.focus();
        }
        wasPending.current = pending;
    }, [pending]);

    return (
        <div className={styles.bar} ref={root} role="region" aria-label="AI bar">
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
                    </div>
                    <Reply turn={current} onDiscard={chat.discard} onAccept={accept} />
                </div>
            )}
            <Composer
                chat={chatState}
                field={field}
                compact
                leading={
                    <span className={styles.barIcon}>
                        <Sparkles {...ICON} />
                    </span>
                }
                trailing={
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
                }
            />
        </div>
    );
};
