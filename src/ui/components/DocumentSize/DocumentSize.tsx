import React, { FC, useEffect, useState } from 'react';
import { json } from 'overmind';
import { useAppState, useEffects } from 'src/app/hooks';
import {
    formatSize,
    measureDocument,
    sizeLevel,
    tooLargeMessage,
    type DocumentSizeConfiguration
} from 'src/app/services/documentSize';
import styles from './styles.css';

/** Measured when the document opens, then at most once per configured interval while it changes. */
export function useDocumentBytes(
    documentId: string,
    { warningBytes, measureEveryMs, measureLargeEveryMs }: DocumentSizeConfiguration
): number | undefined {
    const { collaboration } = useEffects();
    const modified = useAppState((state) => state.documents[documentId]?.modified);
    const [measured, setMeasured] = useState<{ documentId: string; bytes?: number }>();
    const [due, setDue] = useState(0);

    useEffect(() => {
        let current = true;
        const timer = setTimeout(
            () => {
                void import('yjs').then((yjs) => {
                    if (!current) {
                        return;
                    }

                    const bytes = measureDocument(
                        () => collaboration.state(documentId),
                        yjs,
                        warningBytes
                    );

                    setDue(
                        Date.now() +
                            ((bytes ?? 0) >= warningBytes ? measureLargeEveryMs : measureEveryMs)
                    );
                    setMeasured({ documentId, bytes });
                });
            },
            Math.max(0, due - Date.now())
        );

        return () => {
            current = false;
            clearTimeout(timer);
        };
        // `due` changes only as it measures, which must not measure again.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [collaboration, documentId, modified, warningBytes, measureEveryMs, measureLargeEveryMs]);

    return measured?.documentId === documentId ? measured.bytes : undefined;
}

/** A dismissed warning returns once the document grows past another megabyte. */
export const DocumentSize: FC = () => {
    const documentId = useAppState((state) => state.currentDocumentId);
    const name = useAppState((state) => state.documents[state.currentDocumentId]?.name);
    const heldBack = useAppState((state) => state.tooLargeToSync[state.currentDocumentId]);
    const limits = useAppState((state) => json(state.config.documentSize));
    const bytes = useDocumentBytes(documentId, limits);
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

    if (bytes === undefined || sizeLevel(bytes, limits) === 'fits') {
        return null;
    }

    const megabytes = Math.floor(bytes / (1024 * 1024));

    if ((dismissed[documentId] ?? -1) >= megabytes) {
        return null;
    }

    return (
        <div className={`${styles.notice} ${styles.warning}`} role="status">
            <span>
                This document is {formatSize(bytes)}. Over {formatSize(limits.uploadBytes)}, a
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
