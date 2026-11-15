import React, { FC, useEffect, useState } from 'react';
import { useAppState, useEffects } from 'src/app/hooks';
import {
    MAX_UPLOAD_BYTES,
    SIZE_WARNING_BYTES,
    formatSize,
    measureDocument,
    sizeLevel,
    tooLargeMessage
} from 'src/app/services/documentSize';
import styles from './styles.css';

/**
 * How long after a change the document is measured again, at most once in that
 * time: longer once it is large, as measuring it then reads it into a new copy.
 */
const MEASURE_EVERY = 2000;
const MEASURE_LARGE_EVERY = 15_000;

/**
 * The size of `documentId`'s shared state, measured when it opens and again while
 * it changes, at most every 2 seconds, or 15 once it is large, as encoding it
 * whole takes a while.
 */
export function useDocumentBytes(documentId: string): number | undefined {
    const { collaboration } = useEffects();
    const modified = useAppState((state) => state.documents[documentId]?.modified);
    const [measured, setMeasured] = useState<{ documentId: string; bytes?: number }>();
    const [due, setDue] = useState(0);

    useEffect(() => {
        const wait = Math.max(0, due - Date.now());
        let current = true;
        const timer = setTimeout(() => {
            // Loaded already by the documents' collaboration.
            void import('yjs').then((yjs) => {
                if (!current) {
                    return;
                }

                const bytes = measureDocument(() => collaboration.state(documentId), yjs);

                setDue(
                    Date.now() +
                        ((bytes ?? 0) >= SIZE_WARNING_BYTES ? MEASURE_LARGE_EVERY : MEASURE_EVERY)
                );
                setMeasured({ documentId, bytes });
            });
        }, wait);

        return () => {
            current = false;
            clearTimeout(timer);
        };
        // `due` changes only as it measures, which must not measure again.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [collaboration, documentId, modified]);

    return measured?.documentId === documentId ? measured.bytes : undefined;
}

/**
 * Says when the document shown is growing too large to sync (from 3 MB of shared
 * state), and why one the server sync holds back is kept only in this browser.
 * The warning can be dismissed for the document until it grows past another
 * megabyte; the hold-back stays until the document is smaller.
 */
export const DocumentSize: FC = () => {
    const documentId = useAppState((state) => state.currentDocumentId);
    const name = useAppState((state) => state.documents[state.currentDocumentId]?.name);
    const heldBack = useAppState((state) => state.tooLargeToSync[state.currentDocumentId]);
    const bytes = useDocumentBytes(documentId);
    const [dismissed, setDismissed] = useState<Record<string, number>>({});

    if (heldBack !== undefined) {
        return (
            <div className={`${styles.notice} ${styles.error}`} role="alert">
                <span>
                    {tooLargeMessage(name, heldBack)} Move some screens into another document, or
                    remove content it no longer needs.
                </span>
            </div>
        );
    }

    if (bytes === undefined || sizeLevel(bytes) === 'fits') {
        return null;
    }

    const megabytes = Math.floor(bytes / (1024 * 1024));

    if ((dismissed[documentId] ?? -1) >= megabytes) {
        return null;
    }

    return (
        <div className={`${styles.notice} ${styles.warning}`} role="status">
            <span>
                This document is {formatSize(bytes)}. Over {formatSize(MAX_UPLOAD_BYTES)}, a
                document cannot be moved into an account, and large changes to it may not sync. Move
                some screens into another document to keep it smaller.
            </span>
            <button
                type="button"
                className={styles.dismiss}
                onClick={() => setDismissed({ ...dismissed, [documentId]: megabytes })}
            >
                Dismiss
            </button>
        </div>
    );
};
