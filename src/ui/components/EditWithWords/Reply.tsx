import { Check, Minus, Plus, X } from 'lucide-react';
import React, { FC, useState } from 'react';
import type { ChatTurn } from 'src/ai/chat';
import { describeOperation } from 'src/ai/describe';
import type { ProposedOperation } from 'src/ai/operations';
import { useCurrentDocument } from 'src/app/hooks';
import { ProposalPreview } from './ProposalPreview';
import styles from './styles.css';
import { Words } from './Words';

const ICON = { size: 12, strokeWidth: 2.25, 'aria-hidden': true } as const;

const count = (operations: readonly unknown[]) =>
    `${operations.length} ${operations.length === 1 ? 'change' : 'changes'}`;

/** A proposal's changes, each marked as an addition, a change or a deletion. */
const Changes: FC<{ operations: ProposedOperation[] }> = ({ operations }) => {
    const document = useCurrentDocument();

    return (
        <ol className={styles.operations} aria-label="Changes">
            {operations.map((operation, index) => {
                const kind = operation.op.startsWith('add')
                    ? 'add'
                    : operation.op.startsWith('delete')
                      ? 'delete'
                      : 'change';

                return (
                    <li key={index}>
                        <span className={styles.operationKind} data-kind={kind}>
                            {kind === 'add' ? (
                                <Plus {...ICON} />
                            ) : kind === 'delete' ? (
                                <Minus {...ICON} />
                            ) : (
                                <span className={styles.changeDot} />
                            )}
                        </span>
                        <span>{describeOperation(operation, document, operations)}</span>
                    </li>
                );
            })}
        </ol>
    );
};

/** A finished turn in one line, whose changes can be shown again. */
const Outcome: FC<{ turn: ChatTurn }> = ({ turn }) => {
    const [open, setOpen] = useState(false);
    const accepted = turn.status === 'accepted';
    const shown = accepted && turn.operations.length > 0;

    return (
        <>
            <p
                className={styles.outcome}
                role="status"
                title={accepted ? 'Undo reverts it in one step.' : undefined}
            >
                {accepted ? <Check {...ICON} className={styles.applied} /> : <X {...ICON} />}
                <span>
                    {accepted
                        ? `Applied ${count(turn.operations)}.`
                        : turn.status === 'discarded'
                          ? 'Discarded. Nothing changed.'
                          : 'Stopped. Nothing changed.'}
                </span>
                {shown && (
                    <button
                        type="button"
                        className={styles.link}
                        aria-expanded={open}
                        onClick={() => setOpen(!open)}
                    >
                        {open ? 'Hide changes' : 'Show changes'}
                    </button>
                )}
            </p>
            {open && <Changes operations={turn.operations} />}
        </>
    );
};

/** What AI answered to one request: its words, then the proposal, the work under way or the outcome. */
export const Reply: FC<{
    turn: ChatTurn;
    onDiscard: () => void;
    onAccept: () => void;
    /** Puts an example from the answer in the prompt; without it, examples are only shown. */
    onExample?: (example: string) => void;
}> = ({ turn, onDiscard, onAccept, onExample }) => {
    // An answer in words only is shown once, as the model's words.
    const failedInWords = turn.status === 'failed' && turn.problem === turn.messages.join('\n');

    return (
        <section className={styles.reply} aria-label="Proposal">
            {turn.messages.map((message, index) => (
                <Words key={index} message={message} onExample={onExample} />
            ))}
            {turn.status === 'proposing' && (
                <p className={styles.working} role="status">
                    <span className={styles.dots} aria-hidden="true">
                        <i />
                        <i />
                        <i />
                    </span>
                    {turn.repairing ? `Fixing a problem: ${turn.repairing}` : 'Waiting for AI…'}
                </p>
            )}
            {turn.status === 'proposed' && (
                <div className={styles.card}>
                    <p className={styles.cardTitle}>{count(turn.operations)}</p>
                    <ProposalPreview
                        operations={turn.operations}
                        onDiscard={onDiscard}
                        onAccept={onAccept}
                    >
                        <Changes operations={turn.operations} />
                    </ProposalPreview>
                </div>
            )}
            {turn.status === 'failed' && !failedInWords && (
                <p className={styles.problem} role="alert">
                    {turn.problem}
                </p>
            )}
            {(turn.status === 'accepted' ||
                turn.status === 'discarded' ||
                turn.status === 'cancelled') && <Outcome turn={turn} />}
        </section>
    );
};
