import React, { FC, useEffect, useState } from 'react';
import { useActions, useAppState } from 'src/app/hooks';
import type { Document } from 'src/app/types';
import {
    listSnapshots,
    readSnapshot,
    restoreSnapshot,
    type Snapshot,
    type SnapshotReason
} from 'src/app/services/documentHistory';
import { Dialog } from '../Dialog';
import { DocumentThumbnail } from '../DocumentList/DocumentThumbnail';
import styles from './styles.css';

const REASONS: Record<SnapshotReason, string | undefined> = {
    scheduled: undefined,
    'before-restore': 'Before a restore',
    deleted: 'When it was deleted'
};

const DAY = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
});
const TIME = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

/** When a snapshot was taken, as "Today, 10:15" or "Thu, Nov 12, 18:00". */
export function snapshotTime(date: Date, now = new Date()): string {
    const sameDay = (other: Date) => other.toDateString() === date.toDateString();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const day = sameDay(now) ? 'Today' : sameDay(yesterday) ? 'Yesterday' : DAY.format(date);

    return `${day}, ${TIME.format(date)}`;
}

type Listing = { kind: 'loading' } | { kind: 'failed' } | { kind: 'listed'; snapshots: Snapshot[] };

type Preview = { kind: 'loading' } | { kind: 'failed' } | { kind: 'shown'; document: Document };

/**
 * The earlier versions of a document the server keeps, newest first. Choosing one
 * draws it; Restore brings the document back to it for everyone, after the server
 * keeps the current content, so a restore can be undone by restoring that.
 */
export const DocumentHistory: FC<{ documentId: string }> = ({ documentId }) => {
    const name = useAppState((state) => state.documents[documentId]?.name ?? '');
    const { closeDocumentHistory, displayError, displaySuccess } = useActions();
    const [listing, setListing] = useState<Listing>({ kind: 'loading' });
    const [chosen, setChosen] = useState<Snapshot | null>(null);
    const [preview, setPreview] = useState<Preview | null>(null);
    const [restoring, setRestoring] = useState(false);

    useEffect(() => {
        let current = true;

        listSnapshots(documentId).then(
            (snapshots) => current && setListing({ kind: 'listed', snapshots }),
            (error: { status?: number }) =>
                // A document not on the server yet has no history there.
                current &&
                setListing(
                    error.status === 404 ? { kind: 'listed', snapshots: [] } : { kind: 'failed' }
                )
        );

        return () => {
            current = false;
        };
    }, [documentId]);

    useEffect(() => {
        if (!chosen) return;
        let current = true;

        setPreview({ kind: 'loading' });
        readSnapshot(documentId, chosen.id).then(
            (document) =>
                current && setPreview(document ? { kind: 'shown', document } : { kind: 'failed' }),
            () => current && setPreview({ kind: 'failed' })
        );

        return () => {
            current = false;
        };
    }, [documentId, chosen]);

    const restore = async () => {
        if (!chosen) return;
        setRestoring(true);

        try {
            await restoreSnapshot(documentId, chosen.id);
            displaySuccess(`Restored “${name}” to ${snapshotTime(chosen.createdAt)}`);
            closeDocumentHistory();
        } catch {
            displayError('The version could not be restored. Try again.');
            setRestoring(false);
        }
    };

    const now = new Date();

    return (
        <Dialog
            title="Document history"
            description={`Earlier versions of “${name}” the server keeps: every hour it changed in the last day, then one a day for 30 days. Restoring one changes the document for everyone, and the current version is kept here first.`}
            visible
            wide
            onClose={() => closeDocumentHistory()}
            actions={
                <>
                    <button type="button" onClick={() => closeDocumentHistory()}>
                        Close
                    </button>
                    <button
                        type="button"
                        data-variant="primary"
                        disabled={!chosen?.restorable || restoring}
                        onClick={() => void restore()}
                    >
                        {restoring ? 'Restoring…' : 'Restore this version'}
                    </button>
                </>
            }
        >
            <div className={styles.history}>
                {listing.kind === 'loading' && <p role="status">Loading history…</p>}
                {listing.kind === 'failed' && (
                    <p role="alert">History could not be loaded. Check your connection.</p>
                )}
                {listing.kind === 'listed' && listing.snapshots.length === 0 && (
                    <p className={styles.empty}>
                        No earlier versions yet. The server keeps one about every hour while the
                        document changes.
                    </p>
                )}
                {listing.kind === 'listed' && listing.snapshots.length > 0 && (
                    <>
                        <ul className={styles.versions} aria-label="Versions">
                            {listing.snapshots.map((snapshot) => (
                                <li key={snapshot.id}>
                                    <button
                                        type="button"
                                        aria-pressed={chosen?.id === snapshot.id}
                                        onClick={() => setChosen(snapshot)}
                                    >
                                        <span>{snapshotTime(snapshot.createdAt, now)}</span>
                                        {REASONS[snapshot.reason] && (
                                            <small>{REASONS[snapshot.reason]}</small>
                                        )}
                                        {!snapshot.restorable && (
                                            <small>Made by a newer version of Reactor</small>
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                        <figure className={styles.preview} aria-label="Preview">
                            {!preview && <p>Choose a version to see it.</p>}
                            {preview?.kind === 'loading' && <p role="status">Loading…</p>}
                            {preview?.kind === 'failed' && (
                                <p role="alert">This version could not be shown.</p>
                            )}
                            {preview?.kind === 'shown' && (
                                <DocumentThumbnail document={preview.document} />
                            )}
                        </figure>
                    </>
                )}
            </div>
        </Dialog>
    );
};
