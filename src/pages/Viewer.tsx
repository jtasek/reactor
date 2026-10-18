import React, { FC, useState } from 'react';
import { useCurrentDocument } from 'src/app/hooks';
import { DocumentThumbnail } from 'src/ui/components/DocumentList/DocumentThumbnail';
import styles from './Sharing.css';

/** A live preview without editor gestures, command bars or editable panels. */
export const Viewer: FC<{ checking: boolean }> = ({ checking }) => {
    const document = useCurrentDocument();
    const [zoom, setZoom] = useState(1);
    return (
        <main className={styles.page}>
            <nav aria-label="Document viewer">
                <a href="/documents">Documents</a> · <a href="/account">Account</a>
            </nav>
            <h1>{document.name}</h1>
            <p role="status">
                {checking
                    ? 'Access could not be confirmed yet. This document is read-only until the server can be reached.'
                    : 'View only — changes from editors appear here automatically.'}
            </p>
            <div role="group" aria-label="Preview zoom">
                <button
                    type="button"
                    disabled={zoom <= 1}
                    onClick={() => setZoom(Math.max(1, zoom - 0.5))}
                >
                    Zoom out
                </button>{' '}
                <button
                    type="button"
                    disabled={zoom >= 4}
                    onClick={() => setZoom(Math.min(4, zoom + 0.5))}
                >
                    Zoom in
                </button>{' '}
                <button type="button" onClick={() => setZoom(1)}>
                    Fit
                </button>
            </div>
            <div
                className={styles.preview}
                style={{ width: `${zoom * 100}%`, height: `${zoom * 60}vh` }}
            >
                <DocumentThumbnail document={document} />
            </div>
        </main>
    );
};
