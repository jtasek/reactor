import React, { FC, MouseEvent, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { documentTagTone, normalizeTags } from 'src/app/documentList';
import { TagPicker } from './TagPicker';
import styles from './tags.css';

interface Props {
    tags: string[];
    availableTags: string[];
    onChange: (tags: string[]) => void;
    onFilter?: (tag: string) => void;
}

const COLLAPSED_TAG_COUNT = 2;

export const DocumentTags: FC<Props> = ({ tags, availableTags, onChange, onFilter }) => {
    const [expanded, setExpanded] = useState(false);
    const [editing, setEditing] = useState(false);
    const editButton = useRef<HTMLButtonElement>(null);
    const uniqueTags = normalizeTags(tags);
    const visibleTags = expanded ? uniqueTags : uniqueTags.slice(0, COLLAPSED_TAG_COUNT);
    const hiddenCount = uniqueTags.length - COLLAPSED_TAG_COUNT;
    const toggleExpanded = () => setExpanded(!expanded);
    const openPicker = () => setEditing(true);
    const closePicker = () => setEditing(false);
    const filterTag = (event: MouseEvent<HTMLButtonElement>) =>
        onFilter?.(event.currentTarget.value);

    return (
        <div className={styles.tags}>
            {visibleTags.map((tag) =>
                onFilter ? (
                    <button
                        key={tag}
                        type="button"
                        className={styles.pill}
                        data-tone={documentTagTone(tag)}
                        title={`Filter by ${tag}`}
                        value={tag}
                        onClick={filterTag}
                    >
                        {tag}
                    </button>
                ) : (
                    <span key={tag} className={styles.pill} data-tone={documentTagTone(tag)}>
                        {tag}
                    </span>
                )
            )}
            {hiddenCount > 0 && (
                <button
                    type="button"
                    className={styles.more}
                    aria-expanded={expanded}
                    onClick={toggleExpanded}
                >
                    {expanded ? 'Less' : `+${hiddenCount}`}
                </button>
            )}
            <button
                type="button"
                ref={editButton}
                className={styles.add}
                aria-haspopup="dialog"
                aria-expanded={editing}
                title="Edit tags"
                aria-label="Edit tags"
                onClick={openPicker}
            >
                <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
            {editing && editButton.current && (
                <TagPicker
                    anchor={editButton.current}
                    title="Edit tags"
                    availableTags={availableTags}
                    selectedTags={tags}
                    onChange={onChange}
                    onClose={closePicker}
                    allowCreate
                />
            )}
        </div>
    );
};
