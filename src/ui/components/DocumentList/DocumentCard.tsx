import React, { FC, useEffect, useRef, useState } from 'react';
import { useActions, useDocument } from 'src/app/hooks';
import { Dialog } from '../Dialog';
import { Icon } from '../Icon';
import { DocumentThumbnail } from './DocumentThumbnail';
import styles from './styles.css';

interface Props {
    documentId: string;
    current: boolean;
}

export const DocumentCard: FC<Props> = ({ documentId, current }) => {
    const document = useDocument(documentId);
    const { editDocument, cloneDocument, removeDocument, updateDocument } = useActions();
    const [confirming, setConfirming] = useState(false);
    const [editingName, setEditingName] = useState(false);
    const [draftName, setDraftName] = useState('');
    const nameInput = useRef<HTMLInputElement>(null);
    const renameButton = useRef<HTMLButtonElement>(null);
    const restoreRenameFocus = useRef(false);
    // A browser that blurs the field as it is removed must not save what Escape discarded.
    const discardingName = useRef(false);

    useEffect(() => {
        if (editingName) {
            nameInput.current?.focus();
            nameInput.current?.select();

            return;
        }

        if (restoreRenameFocus.current) {
            restoreRenameFocus.current = false;
            renameButton.current?.focus();
        }
    }, [editingName]);

    const saveName = () => {
        const name = draftName.trim();

        if (discardingName.current) {
            discardingName.current = false;
            return;
        }

        if (name && name !== document.name) {
            updateDocument({ id: documentId, name });
        }

        setEditingName(false);
    };

    const beginRename = () => {
        setDraftName(document.name);
        setEditingName(true);
    };

    return (
        <li className={styles.card} aria-current={current || undefined}>
            <div className={styles.thumbnail}>
                <DocumentThumbnail document={document} />
            </div>
            <div className={styles.cardBody}>
                <div className={styles.cardTitle}>
                    {editingName ? (
                        <input
                            ref={nameInput}
                            className={styles.nameInput}
                            aria-label={`Name for ${document.name}`}
                            value={draftName}
                            onChange={(event) => setDraftName(event.target.value)}
                            onBlur={saveName}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    restoreRenameFocus.current = true;
                                    saveName();
                                }
                                if (event.key === 'Escape') {
                                    event.preventDefault();
                                    restoreRenameFocus.current = true;
                                    discardingName.current = true;
                                    setEditingName(false);
                                }
                            }}
                        />
                    ) : (
                        <button
                            type="button"
                            className={styles.nameButton}
                            aria-label={`Open ${document.name}`}
                            title={`Open ${document.name}`}
                            onClick={() => editDocument(documentId)}
                        >
                            {document.name}
                        </button>
                    )}
                    {current && <span className={styles.current}>Current</span>}
                </div>
                <div className={styles.meta}>
                    <span>
                        {document.shapesIds.length}{' '}
                        {document.shapesIds.length === 1 ? 'shape' : 'shapes'}
                    </span>
                    <time dateTime={document.created.toISOString()}>
                        {document.created.toLocaleDateString()}
                    </time>
                </div>
                <div className={styles.actions}>
                    <div className={styles.iconActions}>
                        <button
                            ref={renameButton}
                            className={styles.iconButton}
                            type="button"
                            aria-label={`Rename ${document.name}`}
                            title={`Rename ${document.name}`}
                            onClick={beginRename}
                        >
                            <Icon icon={{ group: 'image', name: 'edit', size: 18 }} />
                        </button>
                        <button
                            className={styles.iconButton}
                            type="button"
                            aria-label={`Clone ${document.name}`}
                            title={`Clone ${document.name}`}
                            onClick={() => cloneDocument(documentId)}
                        >
                            <Icon icon={{ group: 'content', name: 'content_copy', size: 18 }} />
                        </button>
                        <button
                            className={styles.iconButton}
                            type="button"
                            aria-label={`Delete ${document.name}`}
                            title={`Delete ${document.name}`}
                            onClick={() => setConfirming(true)}
                        >
                            <Icon icon={{ group: 'action', name: 'delete', size: 18 }} />
                        </button>
                    </div>
                </div>
            </div>
            <Dialog
                title="Delete this document?"
                description={`“${document.name}” and everything on it will be removed.`}
                visible={confirming}
                onClose={() => setConfirming(false)}
                actions={
                    <>
                        <button type="button" onClick={() => setConfirming(false)}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            data-variant="primary"
                            onClick={() => removeDocument(documentId)}
                        >
                            Delete document
                        </button>
                    </>
                }
            />
        </li>
    );
};
