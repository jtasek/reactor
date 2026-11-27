import { Maximize2 } from 'lucide-react';
import React, { type FC, type ReactNode, memo, useMemo, useState } from 'react';
import { previewProposal } from 'src/ai/preview';
import { useCurrentDocument } from 'src/app/hooks';
import type { Operation } from 'src/app/operations';
import { untracked } from 'src/app/untracked';
import { DocumentThumbnail } from '../DocumentList/DocumentThumbnail';
import { Dialog } from '../Dialog';
import styles from './styles.css';
import { useProposalRevision } from './useProposalRevision';

/**
 * A proposal's card: its draft result, the list of changes (`children`), then Discard and
 * Accept; Accept is offered only while the draft applies.
 */
export const ProposalPreview: FC<{
    operations: Operation[];
    onDiscard: () => void;
    onAccept: () => void;
    children?: ReactNode;
}> = memo(function ProposalPreview({ operations, onDiscard, onAccept, children }) {
    // Only the document's identity is tracked here; its edits arrive through the settled revision.
    const document = useCurrentDocument();
    const revision = useProposalRevision(document.id);
    const [expanded, setExpanded] = useState(false);
    const preview = useMemo(
        () => previewProposal(untracked(document), operations),
        // `revision` stands for the document's contents, which are read untracked.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [document, operations, revision]
    );

    // A proposal that only adds data changes nothing a drawing could show.
    const drawn =
        preview.valid && (preview.changes.ids.size > 0 || preview.changes.removed.length > 0);

    return (
        <>
            {preview.valid &&
                preview.records.map(({ entity, fields, rows, total }) => (
                    <figure
                        key={entity}
                        className={styles.preview}
                        aria-label={`Proposed records of ${entity}`}
                    >
                        <figcaption>
                            <strong>
                                {entity}: {total} {total === 1 ? 'record' : 'records'}
                            </strong>
                            {total > rows.length && (
                                <span>
                                    The first {rows.length} are shown; all pass their fields&apos;
                                    checks.
                                </span>
                            )}
                        </figcaption>
                        <div className={styles.records}>
                            <table>
                                <thead>
                                    <tr>
                                        {fields.map((field) => (
                                            <th key={field} scope="col">
                                                {field}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row, index) => (
                                        <tr key={index}>
                                            {row.map((value, column) => (
                                                <td key={column}>{value}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </figure>
                ))}
            {!preview.valid ? (
                <p className={styles.problem} role="status">
                    Preview unavailable: {preview.problem} Discard this proposal and request a new
                    one.
                </p>
            ) : (
                drawn && (
                    <figure className={styles.preview} aria-label="Proposed result">
                        <figcaption>
                            <span>Not applied yet. Changes are outlined.</span>
                            <button
                                type="button"
                                className={styles.iconButton}
                                aria-label="Inspect preview"
                                title="Inspect preview"
                                onClick={() => setExpanded(true)}
                            >
                                <Maximize2 aria-hidden="true" size={14} strokeWidth={1.75} />
                            </button>
                        </figcaption>
                        <div className={styles.previewArtwork}>
                            <DocumentThumbnail
                                document={preview.document}
                                changes={preview.changes}
                                fitChanges
                            />
                        </div>
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
                )
            )}
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
});
