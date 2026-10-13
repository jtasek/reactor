import React, { FC } from 'react';
import { Icon } from '../Icon';
import { DocumentCard } from './DocumentCard';
import styles from './styles.css';

interface Props {
    documentsIds: string[];
    currentDocumentId: string;
    onCreate: () => void;
}

export const DocumentList: FC<Props> = ({ documentsIds, currentDocumentId, onCreate }) => (
    <main className={styles.documentList}>
        <div className={styles.panel}>
            <header className={styles.header}>
                <h1>Documents</h1>
                <button className={styles.newButton} type="button" onClick={onCreate}>
                    <Icon icon={{ group: 'content', name: 'add', size: 18 }} />
                    New document
                </button>
            </header>
            <ul className={styles.grid} aria-label="Documents">
                {documentsIds.map((documentId) => (
                    <DocumentCard
                        key={documentId}
                        documentId={documentId}
                        current={documentId === currentDocumentId}
                    />
                ))}
            </ul>
        </div>
    </main>
);
