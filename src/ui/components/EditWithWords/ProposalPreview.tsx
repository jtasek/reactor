import React, { type FC, memo, useEffect, useMemo, useReducer, useState } from 'react';
import { previewProposal } from 'src/ai/preview';
import { useCurrentDocument, useReaction } from 'src/app/hooks';
import type { Operation } from 'src/app/operations';
import { untracked } from 'src/app/untracked';
import { DocumentThumbnail } from '../DocumentList/DocumentThumbnail';
import { Dialog } from '../Dialog';
import styles from './styles.css';

/** How long edits must pause before the draft is built again. */
const PREVIEW_SETTLE_MS = 150;
/** The parts of a document a draft depends on; the camera and other view state are left out. */
const DRAFT_INPUTS = [
    'shapes',
    'shapesIds',
    'frames',
    'groups',
    'layers',
    'components',
    'links',
    'guides',
    'variables',
    'dimensions'
] as const;

/**
 * A number that changes once edits to what a draft depends on have paused, so a
 * gesture or a burst of typing builds the draft once rather than on every change.
 */
function useSettledRevision(documentId: string) {
    const reaction = useReaction();
    const [revision, next] = useReducer((count: number) => count + 1, 0);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const schedule = () => {
            clearTimeout(timer);
            timer = setTimeout(next, PREVIEW_SETTLE_MS);
        };
        const stops = DRAFT_INPUTS.map((key) =>
            reaction((state) => state.documents[documentId][key], schedule, { nested: true })
        );

        stops.push(reaction((state) => state.documents[documentId].locked, schedule));

        return () => {
            clearTimeout(timer);
            stops.forEach((stop) => stop());
        };
    }, [reaction, documentId]);

    return revision;
}

/** A proposal's draft result, with Discard and Accept; Accept is offered only while the draft applies. */
export const ProposalPreview: FC<{
    operations: Operation[];
    onDiscard: () => void;
    onAccept: () => void;
}> = memo(function ProposalPreview({ operations, onDiscard, onAccept }) {
    // Only the document's identity is tracked here; its edits arrive through the settled revision.
    const document = useCurrentDocument();
    const revision = useSettledRevision(document.id);
    const [expanded, setExpanded] = useState(false);
    const preview = useMemo(
        () => previewProposal(untracked(document), operations),
        // `revision` stands for the document's contents, which are read untracked.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [document, operations, revision]
    );

    return (
        <>
            {preview.valid ? (
                <figure className={styles.preview} aria-label="Proposed result">
                    <figcaption>
                        <strong>Proposed result</strong>
                        <span>
                            Not applied. Changes are outlined. Updates with your canvas edits.
                        </span>
                    </figcaption>
                    <div className={styles.previewArtwork}>
                        <DocumentThumbnail
                            document={preview.document}
                            changes={preview.changes}
                            fitChanges
                        />
                    </div>
                    <button type="button" onClick={() => setExpanded(true)}>
                        Inspect preview
                    </button>
                    <Dialog
                        title="Proposed result"
                        description="Draft only, with the changes outlined. Close this preview to accept or discard the changes."
                        visible={expanded}
                        onClose={() => setExpanded(false)}
                    >
                        <div className={styles.expandedArtwork}>
                            <DocumentThumbnail
                                document={preview.document}
                                changes={preview.changes}
                            />
                        </div>
                    </Dialog>
                </figure>
            ) : (
                <p className={styles.problem} role="status">
                    Preview unavailable: {preview.problem} Discard this proposal and request a new
                    one.
                </p>
            )}
            <div className={styles.actions}>
                <button type="button" onClick={onDiscard}>
                    Discard
                </button>
                <button
                    type="button"
                    data-variant="primary"
                    disabled={!preview.valid}
                    onClick={onAccept}
                >
                    Accept
                </button>
            </div>
        </>
    );
});
