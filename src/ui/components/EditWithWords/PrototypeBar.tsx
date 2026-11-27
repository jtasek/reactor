import React, { FC, useEffect, useMemo } from 'react';
import { flowDocumentContext } from 'src/ai/context';
import { previewProposal } from 'src/ai/preview';
import { useCurrentDocument } from 'src/app/hooks';
import type { Document } from 'src/app/types';
import { untracked } from 'src/app/untracked';
import { CanvasBar, type BarPage } from './CanvasBar';
import type { ProposalView } from './Reply';
import styles from './styles.css';
import { useProposalRevision } from './useProposalRevision';

/** A proposal as the player shows it: the controls it changes, and the page it starts on. */
export interface PrototypeProposal {
    controls: string[];
    start?: string;
}

function proposalOf(draft: Document, changed: ReadonlySet<string>): PrototypeProposal {
    const start = [...changed].find((id) => draft.frames[id]?.start);

    return {
        controls: [...changed].filter((id) => draft.shapes[id]?.type === 'instance'),
        ...(start ? { start } : {})
    };
}

/**
 * The proposal's card on Prototype: the player outlines the controls it changes, and Apply
 * and try it applies the change for the player to show.
 */
function prototypeProposal(
    onPreview: (proposal?: PrototypeProposal) => void,
    onApplied: (proposal: PrototypeProposal) => void
): ProposalView {
    return function PrototypeProposalCard({ operations, onDiscard, onAccept, children }) {
        const document = useCurrentDocument();
        const revision = useProposalRevision(document.id);
        const preview = useMemo(
            () => previewProposal(untracked(document), operations),
            // eslint-disable-next-line react-hooks/exhaustive-deps -- revision tracks the untracked document contents.
            [document, operations, revision]
        );
        const proposal = useMemo(
            () => (preview.valid ? proposalOf(preview.document, preview.changes.ids) : undefined),
            [preview]
        );

        useEffect(() => {
            if (!proposal) {
                return undefined;
            }
            onPreview(proposal);

            return () => onPreview(undefined);
        }, [proposal]);

        return (
            <>
                <p className={styles.barPrompt}>
                    {!proposal
                        ? `This no longer applies: ${preview.valid ? '' : preview.problem}`
                        : proposal.controls.length
                          ? 'Not applied yet. The control is outlined in the player.'
                          : 'Not applied yet.'}
                </p>
                {children}
                <div className={styles.actions}>
                    <button type="button" className={styles.button} onClick={onDiscard}>
                        Discard
                    </button>
                    <button
                        type="button"
                        className={styles.button}
                        data-variant="primary"
                        disabled={!proposal}
                        onClick={() => {
                            if (onAccept() && proposal) {
                                onApplied(proposal);
                            }
                        }}
                    >
                        Apply and try it
                    </button>
                </div>
            </>
        );
    };
}

/** The canvas bar on Prototype, opened from its button, for what taps do in words. */
export const PrototypeBar: FC<{
    documentId: string;
    /** The page the player shows, named on the chip and shared with AI. */
    screen?: { id: string; name: string };
    onPreview: (proposal?: PrototypeProposal) => void;
    onApplied: (proposal: PrototypeProposal) => void;
    onClose: () => void;
}> = ({ documentId, screen, onPreview, onApplied, onClose }) => {
    const proposal = useMemo(() => prototypeProposal(onPreview, onApplied), [onPreview, onApplied]);
    const page = useMemo<BarPage>(
        () => ({
            scope: {
                label: screen?.name ?? 'Prototype',
                title: 'Shares the pages, their controls and what each does, and the prototype’s states. A control you name is looked for on this page first.',
                whole: false
            },
            context: (document) => flowDocumentContext(document, screen?.id),
            placeholder: 'Describe a tap, like “Open Details when I click Continue”',
            proposal,
            onClose
        }),
        [screen?.id, screen?.name, proposal, onClose]
    );

    return <CanvasBar documentId={documentId} page={page} />;
};
