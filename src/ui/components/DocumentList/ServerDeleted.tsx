import React, { FC, useEffect, useState } from 'react';
import {
    listDeletedDocuments,
    restoreDeletedDocument,
    type DeletedDocument
} from 'src/app/services/documentHistory';
import styles from './serverDeleted.css';

const DATE = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

type Listing =
    | { kind: 'loading' }
    | { kind: 'failed' }
    | { kind: 'listed'; documents: DeletedDocument[] };

/**
 * Documents deleted for good here or elsewhere that the server still keeps, in the
 * workspaces this person administers. Restoring one adds it back as a new document.
 */
export const ServerDeleted: FC<{ onRestored: (name: string) => void }> = ({ onRestored }) => {
    const [listing, setListing] = useState<Listing>({ kind: 'loading' });
    const [restoring, setRestoring] = useState<string | null>(null);
    const [failed, setFailed] = useState<string | null>(null);

    useEffect(() => {
        let current = true;

        listDeletedDocuments().then(
            (documents) => current && setListing({ kind: 'listed', documents }),
            () => current && setListing({ kind: 'failed' })
        );

        return () => {
            current = false;
        };
    }, []);

    if (
        listing.kind === 'loading' ||
        (listing.kind === 'listed' && listing.documents.length === 0)
    ) {
        return null;
    }

    const restore = async (deleted: DeletedDocument) => {
        setRestoring(deleted.id);
        setFailed(null);

        try {
            await restoreDeletedDocument(deleted);
            setListing({
                kind: 'listed',
                documents:
                    listing.kind === 'listed'
                        ? listing.documents.filter(({ id }) => id !== deleted.id)
                        : []
            });
            // This copy catches up with the server as when the tab is shown again, so the
            // restored document arrives.
            document.dispatchEvent(new Event('visibilitychange'));
            onRestored(deleted.name);
        } catch {
            setFailed(deleted.id);
        } finally {
            setRestoring(null);
        }
    };

    return (
        <section className={styles.serverDeleted} aria-labelledby="server-deleted-title">
            <h2 id="server-deleted-title">Kept on the server</h2>
            <p>
                Deleted for good, but the server keeps them for 30 days. Restoring one adds it back
                as a new document.
            </p>
            {listing.kind === 'failed' ? (
                <p role="alert">Documents kept on the server could not be loaded.</p>
            ) : (
                <ul>
                    {listing.documents.map((document) => (
                        <li key={document.id}>
                            <span>
                                <strong>{document.name}</strong>
                                <small>Deleted {DATE.format(document.deletedAt)}</small>
                            </span>
                            {failed === document.id && (
                                <small role="alert">Could not be restored. Try again.</small>
                            )}
                            <button
                                type="button"
                                disabled={restoring !== null}
                                aria-label={`Restore ${document.name}`}
                                onClick={() => void restore(document)}
                            >
                                {restoring === document.id ? 'Restoring…' : 'Restore'}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
};

export default ServerDeleted;
