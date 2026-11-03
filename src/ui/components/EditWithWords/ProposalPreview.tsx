import React, { type FC, useState } from 'react';
import { previewProposal } from 'src/ai/preview';
import { useCurrentDocument } from 'src/app/hooks';
import type { Operation } from 'src/app/operations';
import { DocumentThumbnail } from '../DocumentList/DocumentThumbnail';
import { Dialog } from '../Dialog';
import styles from './styles.css';

/** Reading the document here subscribes this draft to edits while review stays open. */
export const ProposalPreview: FC<{ operations: Operation[] }> = ({ operations }) => {
    const document = useCurrentDocument();
    const [expanded, setExpanded] = useState(false);
    const preview = previewProposal(document, operations);

    if (!preview.valid) {
        return (
            <p className={styles.problem} role="status">
                Preview unavailable: {preview.problem} Discard this proposal and request a new one.
            </p>
        );
    }

    return (
        <figure className={styles.preview} aria-label="Proposed result">
            <figcaption>
                <strong>Proposed result</strong>
                <span>Not applied. Updates with your canvas edits.</span>
            </figcaption>
            <div className={styles.previewArtwork}>
                <DocumentThumbnail document={preview.document} />
            </div>
            <button type="button" onClick={() => setExpanded(true)}>
                Inspect preview
            </button>
            <Dialog
                title="Proposed result"
                description="Draft only. Close this preview to accept or discard the changes."
                visible={expanded}
                onClose={() => setExpanded(false)}
            >
                <div className={styles.expandedArtwork}>
                    <DocumentThumbnail document={preview.document} />
                </div>
            </Dialog>
        </figure>
    );
};
