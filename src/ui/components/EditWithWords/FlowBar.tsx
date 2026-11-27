import React, { FC, useEffect, useMemo } from 'react';
import { flowDocumentContext } from 'src/ai/context';
import { previewProposal } from 'src/ai/preview';
import { useCurrentDocument } from 'src/app/hooks';
import type { Document } from 'src/app/types';
import { untracked } from 'src/app/untracked';
import { CanvasBar, type BarPage } from './CanvasBar';
import type { ProposalView } from './Reply';
import styles from './styles.css';

/** A proposal as Flow draws it: the document as it would be, and the controls it changes. */
export interface FlowPreview {
    document: Document;
    changed: ReadonlySet<string>;
}

const SCOPE = {
    label: 'Flow',
    title: 'Shares the pages, their controls and what each does, and the prototype’s states.',
    whole: true
};

/**
 * The proposal's card on Flow: the board draws the change, so the card lists it and offers
 * Discard and Accept while it applies.
 */
function flowProposal(onPreview: (preview?: FlowPreview) => void): ProposalView {
    return function FlowProposal({ operations, onDiscard, onAccept, children }) {
        const document = useCurrentDocument();
        const preview = useMemo(
            () => previewProposal(untracked(document), operations),
            [document, operations]
        );

        useEffect(() => {
            if (!preview.valid) {
                return undefined;
            }
            const draft = preview.document;
            // A draft is a plain copy: Flow reads the record lists the store would derive.
            onPreview({
                document: {
                    ...draft,
                    groupsIds: Object.keys(draft.groups),
                    layersIds: Object.keys(draft.layers),
                    componentsIds: Object.keys(draft.components)
                },
                changed: preview.changes.ids
            });

            return () => onPreview(undefined);
        }, [preview]);

        return (
            <>
                <p className={styles.barPrompt}>
                    {preview.valid
                        ? 'Not applied yet. The change is dashed on the board.'
                        : `This no longer applies: ${preview.problem}`}
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
                        disabled={!preview.valid}
                        onClick={onAccept}
                    >
                        Accept
                    </button>
                </div>
            </>
        );
    };
}

/** The canvas bar resting at the foot of Flow, for links and the start page in words. */
export const FlowBar: FC<{
    documentId: string;
    onPreview: (preview?: FlowPreview) => void;
}> = ({ documentId, onPreview }) => {
    const page = useMemo<BarPage>(
        () => ({
            scope: SCOPE,
            context: flowDocumentContext,
            placeholder: 'Describe a link, like “Open Details when I click Continue”',
            proposal: flowProposal(onPreview)
        }),
        [onPreview]
    );

    return <CanvasBar documentId={documentId} page={page} />;
};
