import React, { FC, useEffect, useRef, useState } from 'react';
import { useActions, useDocument } from 'src/app/hooks';
import styles from './styles.css';

interface Props {
    documentId: string;
    current: boolean;
}

export const DocumentRow: FC<Props> = ({ documentId, current }) => {
    const document = useDocument(documentId);
    const { editDocument, cloneDocument, removeDocument } = useActions();
    const [confirming, setConfirming] = useState(false);
    const wasConfirming = useRef(false);
    const deleteButton = useRef<HTMLButtonElement>(null);
    const cancelButton = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (confirming) {
            wasConfirming.current = true;
            cancelButton.current?.focus();

            return;
        }

        if (wasConfirming.current) {
            deleteButton.current?.focus();
        }
    }, [confirming]);

    return (
        <tr aria-current={current || undefined}>
            <th scope="row">
                {document.name}
                {current && (
                    <>
                        {' '}
                        <span className={styles.current}>Current</span>
                    </>
                )}
            </th>
            <td>{document.shapesIds.length}</td>
            <td>
                <time dateTime={document.created.toISOString()}>
                    {document.created.toLocaleDateString()}
                </time>
            </td>
            <td>
                <div className={styles.actions}>
                    {confirming ? (
                        <>
                            <span>Delete this document?</span>
                            <button type="button" onClick={() => removeDocument(documentId)}>
                                Delete
                            </button>
                            <button
                                type="button"
                                ref={cancelButton}
                                onClick={() => setConfirming(false)}
                            >
                                Cancel
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                type="button"
                                aria-label={`Open ${document.name}`}
                                onClick={() => editDocument(documentId)}
                            >
                                Open
                            </button>
                            <button
                                type="button"
                                aria-label={`Clone ${document.name}`}
                                onClick={() => cloneDocument(documentId)}
                            >
                                Clone
                            </button>
                            <button
                                type="button"
                                ref={deleteButton}
                                aria-label={`Delete ${document.name}`}
                                onClick={() => setConfirming(true)}
                            >
                                Delete
                            </button>
                        </>
                    )}
                </div>
            </td>
        </tr>
    );
};
