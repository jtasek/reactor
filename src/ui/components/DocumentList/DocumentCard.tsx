import React, {
    ChangeEvent,
    FC,
    KeyboardEvent,
    MouseEvent,
    useEffect,
    useRef,
    useState
} from 'react';
import { useActions, useDocument } from 'src/app/hooks';
import { documentModifiedLabel } from 'src/app/documentList';
import { Dialog } from '../Dialog';
import { Copy, Pencil, Trash2 } from 'lucide-react';
import { DocumentTags } from './DocumentTags';
import { DocumentThumbnail } from './DocumentThumbnail';
import styles from './styles.css';

interface Props {
    documentId: string;
    current: boolean;
    availableTags: string[];
    onFilterTag: (tag: string) => void;
    now: Date;
}

export const DocumentCard: FC<Props> = ({
    documentId,
    current,
    availableTags,
    onFilterTag,
    now
}) => {
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
        discardingName.current = false;
        setDraftName(document.name);
        setEditingName(true);
    };
    const changeName = (event: ChangeEvent<HTMLInputElement>) => setDraftName(event.target.value);
    const finishName = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            restoreRenameFocus.current = true;
            saveName();
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            restoreRenameFocus.current = true;
            discardingName.current = true;
            setEditingName(false);
        }
    };
    const open = () => editDocument(documentId);
    const openCard = (event: MouseEvent<HTMLLIElement>) => {
        const target = event.target;

        if (
            !(target instanceof Element) ||
            !event.currentTarget.contains(target) ||
            target.closest('button, input, select, textarea, a, label')
        ) {
            return;
        }

        open();
    };
    const clone = () => cloneDocument(documentId);
    const confirmDelete = () => setConfirming(true);
    const cancelDelete = () => setConfirming(false);
    const remove = () => removeDocument(documentId);
    const changeTags = (tags: string[]) => updateDocument({ id: documentId, tags });

    return (
        <li className={styles.card} aria-current={current || undefined} onDoubleClick={openCard}>
            <header className={styles.cardHeader}>
                <div className={styles.cardTitle}>
                    {editingName ? (
                        <input
                            ref={nameInput}
                            className={styles.nameInput}
                            aria-label={`Name for ${document.name}`}
                            value={draftName}
                            onChange={changeName}
                            onBlur={saveName}
                            onKeyDown={finishName}
                        />
                    ) : (
                        <button
                            type="button"
                            className={styles.nameButton}
                            aria-label={`Open ${document.name}`}
                            title={`Open ${document.name}`}
                            onClick={open}
                        >
                            {document.name}
                        </button>
                    )}
                </div>
                <time
                    className={styles.date}
                    dateTime={document.modified.toISOString()}
                    title={`Last edited ${document.modified.toLocaleString()}`}
                >
                    {documentModifiedLabel(document.modified, now)}
                </time>
            </header>
            <div className={styles.thumbnail}>
                <DocumentThumbnail document={document} />
                {current && <span className={styles.current}>Current</span>}
            </div>
            <div className={styles.cardFooter}>
                <DocumentTags
                    tags={[...document.tags]}
                    availableTags={availableTags}
                    onChange={changeTags}
                    onFilter={onFilterTag}
                />
                <div
                    className={styles.iconActions}
                    role="group"
                    aria-label={`Actions for ${document.name}`}
                >
                    <button
                        ref={renameButton}
                        className={styles.iconButton}
                        type="button"
                        aria-label={`Rename ${document.name}`}
                        title={`Rename ${document.name}`}
                        onClick={beginRename}
                    >
                        <Pencil size={16} strokeWidth={1.5} aria-hidden="true" />
                    </button>
                    <button
                        className={styles.iconButton}
                        type="button"
                        aria-label={`Clone ${document.name}`}
                        title={`Clone ${document.name}`}
                        onClick={clone}
                    >
                        <Copy size={16} strokeWidth={1.5} aria-hidden="true" />
                    </button>
                    <button
                        className={styles.iconButton}
                        type="button"
                        data-action="delete"
                        aria-label={`Delete ${document.name}`}
                        title={`Delete ${document.name}`}
                        onClick={confirmDelete}
                    >
                        <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
                    </button>
                </div>
            </div>
            <span className={styles.shapeCount}>
                {document.shapesIds.length} {document.shapesIds.length === 1 ? 'shape' : 'shapes'}
            </span>
            <Dialog
                title="Delete this document?"
                description={`“${document.name}” and everything on it will be removed.`}
                visible={confirming}
                onClose={cancelDelete}
                actions={
                    <>
                        <button type="button" onClick={cancelDelete}>
                            Cancel
                        </button>
                        <button type="button" data-variant="primary" onClick={remove}>
                            Delete document
                        </button>
                    </>
                }
            />
        </li>
    );
};
