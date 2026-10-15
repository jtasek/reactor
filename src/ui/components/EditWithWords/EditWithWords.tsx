import React, { FC, KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { propose, type ProposalEvent } from 'src/ai/client';
import { documentContext } from 'src/ai/context';
import { describeOperation } from 'src/ai/describe';
import type { ProposedOperation } from 'src/ai/operations';
import { useActions, useCurrentDocument } from 'src/app/hooks';
import { Dialog } from '../Dialog';
import styles from './styles.css';

/** What the model said and proposed so far, and what it is fixing. */
interface Proposal {
    operations: ProposedOperation[];
    messages: string[];
    repairing?: string;
}

type Phase =
    | { kind: 'asking'; problem?: string }
    | ({ kind: 'proposing' } & Proposal)
    | ({ kind: 'proposed'; requestId: string; model: string } & Proposal);

/** The proposal as `event` changes it: a repair starts the operations again. */
function receive(proposal: Proposal, event: ProposalEvent): Proposal {
    switch (event.type) {
        case 'operation':
            return { ...proposal, operations: [...proposal.operations, event.operation] };
        case 'message':
            return { ...proposal, messages: [...proposal.messages, event.text] };
        case 'repairing':
            return { ...proposal, operations: [], repairing: event.problem };
    }
}

/**
 * Asks AI for a change to a document in words and shows what it proposes as it
 * streams. Nothing changes until the person accepts, which applies the proposal
 * as one undo step; cancelling or closing stops the model.
 */
export const EditWithWords: FC<{ documentId: string }> = ({ documentId }) => {
    const document = useCurrentDocument();
    const { applyOperations, checkOperations, closeAiEdit } = useActions();
    const [prompt, setPrompt] = useState('');
    const [phase, setPhase] = useState<Phase>({ kind: 'asking' });
    const request = useRef<AbortController>(null);
    const promptField = useRef<HTMLTextAreaElement>(null);
    const formId = useId();

    useEffect(() => () => request.current?.abort(), []);
    useEffect(() => {
        if (phase.kind === 'asking') {
            promptField.current?.focus();
        }
    }, [phase.kind]);

    const ask = async () => {
        const words = prompt.trim();

        if (!words) {
            return;
        }

        const controller = new AbortController();

        request.current = controller;
        setPhase({ kind: 'proposing', operations: [], messages: [] });

        const result = await propose({
            documentId,
            request: { task: 'edit', prompt: words, context: documentContext(document) },
            check: (operations) => checkOperations({ documentId, operations }),
            signal: controller.signal,
            onEvent: (event) =>
                setPhase((current) =>
                    current.kind === 'proposing'
                        ? { ...receive(current, event), kind: 'proposing' }
                        : current
                )
        });

        if (controller.signal.aborted) {
            return;
        }

        switch (result.kind) {
            case 'proposed':
                setPhase((current) => ({
                    kind: 'proposed',
                    requestId: result.requestId,
                    model: result.model,
                    operations: result.operations,
                    messages: current.kind === 'proposing' ? current.messages : []
                }));
                return;
            case 'failed':
                setPhase({ kind: 'asking', problem: result.problem });
                return;
            case 'cancelled':
                setPhase({ kind: 'asking' });
        }
    };

    const cancel = () => {
        request.current?.abort();
        setPhase({ kind: 'asking' });
    };

    const accept = () => {
        if (phase.kind !== 'proposed') {
            return;
        }

        const result = applyOperations({
            documentId,
            by: { kind: 'ai', model: phase.model, requestId: phase.requestId },
            operations: phase.operations
        });

        if (!result.applied) {
            setPhase({ kind: 'asking', problem: result.problem });
            return;
        }

        closeAiEdit();
    };

    const close = () => {
        request.current?.abort();
        closeAiEdit();
    };

    const submitOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            void ask();
        }
    };

    return (
        <Dialog
            title="Edit with words"
            description="Describe a change. Nothing changes until you accept what AI proposes."
            visible
            onClose={close}
            actions={
                <>
                    {phase.kind === 'asking' && (
                        <>
                            <button type="button" onClick={close}>
                                Close
                            </button>
                            <button
                                type="submit"
                                form={formId}
                                data-variant="primary"
                                disabled={!prompt.trim()}
                            >
                                Propose
                            </button>
                        </>
                    )}
                    {phase.kind === 'proposing' && (
                        <button type="button" onClick={cancel}>
                            Cancel
                        </button>
                    )}
                    {phase.kind === 'proposed' && (
                        <>
                            <button type="button" onClick={cancel}>
                                Discard
                            </button>
                            <button type="button" data-variant="primary" onClick={accept}>
                                Accept
                            </button>
                        </>
                    )}
                </>
            }
        >
            <form
                id={formId}
                className={styles.form}
                onSubmit={(event) => {
                    event.preventDefault();
                    void ask();
                }}
            >
                <textarea
                    ref={promptField}
                    className={styles.prompt}
                    aria-label="Change to make"
                    placeholder="Add a sign-in button under the title"
                    value={prompt}
                    readOnly={phase.kind !== 'asking'}
                    onChange={(event) => setPrompt(event.target.value)}
                    // The dialog keeps keys from reaching the editor's shortcuts as they
                    // bubble, so React sees them only as they are captured.
                    onKeyDownCapture={submitOnEnter}
                />
            </form>
            {phase.kind === 'asking' && phase.problem && (
                <p className={styles.problem} role="alert">
                    {phase.problem}
                </p>
            )}
            {phase.kind !== 'asking' && (
                <section className={styles.proposal} aria-label="Proposal" aria-live="polite">
                    {phase.repairing && (
                        <p className={styles.status}>Fixing a problem: {phase.repairing}</p>
                    )}
                    {phase.operations.length > 0 && (
                        <ol className={styles.operations}>
                            {phase.operations.map((operation, index) => (
                                <li key={index}>{describeOperation(operation)}</li>
                            ))}
                        </ol>
                    )}
                    {phase.messages.map((message, index) => (
                        <p key={index} className={styles.message}>
                            {message}
                        </p>
                    ))}
                    {phase.kind === 'proposing' && <p className={styles.status}>Waiting for AI…</p>}
                </section>
            )}
        </Dialog>
    );
};
