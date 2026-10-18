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
import { daysLeftInRecentlyDeleted, documentModifiedLabel } from 'src/app/documentList';
import { tagKey, type TagTone } from 'src/app/tagTones';
import { Dialog } from '../Dialog';
import { CalendarDays, Clock, Copy, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { Avatars } from '../Avatars';
import { DocumentTags } from './DocumentTags';
import { DocumentThumbnail } from './DocumentThumbnail';
import styles from './styles.css';

const daysLeftLabel = (days: number) => (days === 1 ? '1 day left' : `${days} days left`);

interface Props {
    documentId: string;
    current: boolean;
    availableTags: string[];
    tagTones: Readonly<Record<string, string>>;
    onFilterTag: (tag: string) => void;
    onTagTone: (tag: string, tone: TagTone) => void;
    /** Offers to undo moving the document to Recently Deleted. */
    onTrashed: (document: { id: string; name: string }) => void;
    now: Date;
}

export const DocumentCard: FC<Props> = ({
    documentId,
    current,
    availableTags,
    tagTones,
    onFilterTag,
    onTagTone,
    onTrashed,
    now
}) => {
    const document = useDocument(documentId);
    const {
        editDocument,
        cloneDocument,
        removeDocument,
        trashDocument,
        restoreDocument,
        updateDocument
    } = useActions();
    const deleted = document.deleted;
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
            deleted ||
            !(target instanceof Element) ||
            !event.currentTarget.contains(target) ||
            target.closest('button, input, select, textarea, a, label')
        ) {
            return;
        }

        open();
    };
    // A click on the preview opens the document, as a double click anywhere on the card does.
    const openPreview = () => {
        if (!deleted) {
            open();
        }
    };
    const clone = () => cloneDocument(documentId);
    const trash = () => {
        trashDocument(documentId);
        onTrashed({ id: documentId, name: document.name });
    };
    const restore = () => restoreDocument(documentId);
    const confirmDelete = () => setConfirming(true);
    const cancelDelete = () => setConfirming(false);
    const remove = () => removeDocument(documentId);
    // A tag added here keeps the tone it has on other documents.
    const changeTags = (tags: string[]) =>
        updateDocument({
            id: documentId,
            tags,
            tagTones: {
                ...document.tagTones,
                ...Object.fromEntries(
                    tags.flatMap((tag) => {
                        const tone = tagTones[tagKey(tag)];

                        return tone ? [[tagKey(tag), tone]] : [];
                    })
                )
            }
        });

    return (
        <li
            className={styles.card}
            aria-current={current || undefined}
            data-deleted={deleted ? true : undefined}
            onDoubleClick={openCard}
        >
            <header className={styles.cardHeader}>
                <div className={styles.cardTitle}>
                    {deleted ? (
                        <span className={styles.deletedName}>{document.name}</span>
                    ) : editingName ? (
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
                    {current && <span className={styles.current}>Current</span>}
                </div>
                <span className={styles.meta}>
                    <Avatars names={[document.author, document.createdBy, document.modifiedBy]} />
                    <time
                        dateTime={document.modified.toISOString()}
                        title={`Last edited ${document.modified.toLocaleString()}`}
                    >
                        <CalendarDays size={14} strokeWidth={1.5} aria-hidden="true" />
                        {documentModifiedLabel(document.modified, now)}
                    </time>
                    {deleted ? (
                        <span>
                            <Clock size={14} strokeWidth={1.5} aria-hidden="true" />
                            {daysLeftLabel(daysLeftInRecentlyDeleted(deleted, now))}
                        </span>
                    ) : (
                        <span>
                            {document.shapesIds.length}{' '}
                            {document.shapesIds.length === 1 ? 'shape' : 'shapes'}
                        </span>
                    )}
                </span>
            </header>
            <div className={styles.thumbnail} role="presentation" onClick={openPreview}>
                <DocumentThumbnail document={document} />
            </div>
            <div className={styles.cardFooter}>
                {deleted ? (
                    <div />
                ) : (
                    <DocumentTags
                        tags={[...document.tags]}
                        availableTags={availableTags}
                        tagTones={tagTones}
                        onChange={changeTags}
                        onTone={onTagTone}
                        onFilter={onFilterTag}
                    />
                )}
                <div
                    className={styles.iconActions}
                    role="group"
                    aria-label={`Actions for ${document.name}`}
                >
                    {deleted ? (
                        <>
                            <button
                                className={styles.iconButton}
                                type="button"
                                aria-label={`Restore ${document.name}`}
                                title={`Restore ${document.name}`}
                                onClick={restore}
                            >
                                <RotateCcw size={16} strokeWidth={1.5} aria-hidden="true" />
                            </button>
                            <button
                                className={styles.iconButton}
                                type="button"
                                data-action="delete"
                                aria-label={`Delete ${document.name} now`}
                                title={`Delete ${document.name} now`}
                                onClick={confirmDelete}
                            >
                                <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
                            </button>
                        </>
                    ) : (
                        <>
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
                                onClick={trash}
                            >
                                <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
                            </button>
                        </>
                    )}
                </div>
            </div>
            <Dialog
                title={`Delete “${document.name}” now?`}
                description="It is deleted for good, on every device. This can’t be undone."
                visible={confirming}
                onClose={cancelDelete}
                actions={
                    <>
                        <button type="button" onClick={cancelDelete}>
                            Cancel
                        </button>
                        <button type="button" data-variant="destructive" onClick={remove}>
                            Delete
                        </button>
                    </>
                }
            />
        </li>
    );
};
