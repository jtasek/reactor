import React, { FC } from 'react';
import { DocumentRow } from './DocumentRow';
import styles from './styles.css';

interface Props {
    documentsIds: string[];
    currentDocumentId: string;
    onCreate: () => void;
}

/** Every document, with the current one marked, and a button to create another. */
export const DocumentList: FC<Props> = ({ documentsIds, currentDocumentId, onCreate }) => (
    <main className={styles.documentList}>
        <header className={styles.header}>
            <h1>Documents</h1>
            <button type="button" onClick={onCreate}>
                New document
            </button>
        </header>
        <table>
            <thead>
                <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Shapes</th>
                    <th scope="col">Created</th>
                    <th scope="col">Actions</th>
                </tr>
            </thead>
            <tbody>
                {documentsIds.map((documentId) => (
                    <DocumentRow
                        key={documentId}
                        documentId={documentId}
                        current={documentId === currentDocumentId}
                    />
                ))}
            </tbody>
        </table>
    </main>
);
