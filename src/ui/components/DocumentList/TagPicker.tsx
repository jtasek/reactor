import React, { ChangeEvent, FC, FormEvent, useRef, useState } from 'react';
import { documentTagTone, normalizeTags } from 'src/app/documentList';
import { createPortal } from 'react-dom';
import { Check, Plus } from 'lucide-react';
import menuStyles from '../ContextMenu/styles.css';
import { useAnchoredPopup } from './useAnchoredPopup';
import styles from './tags.css';

interface Props {
    anchor: HTMLButtonElement;
    title: string;
    availableTags: string[];
    selectedTags: string[];
    onChange: (tags: string[]) => void;
    onClose: () => void;
    allowCreate?: boolean;
}

export const TagPicker: FC<Props> = ({
    anchor,
    title,
    availableTags,
    selectedTags,
    onChange,
    onClose,
    allowCreate = false
}) => {
    const [search, setSearch] = useState('');
    const popup = useRef<HTMLDivElement>(null);
    useAnchoredPopup(popup, anchor, onClose);
    const searchInput = useRef<HTMLInputElement>(null);
    const selected = normalizeTags(selectedTags);
    // Tags stay listed while the picker is open, also one just taken off its last document.
    const [listed, setListed] = useState(() => normalizeTags([...availableTags, ...selected]));

    const options = normalizeTags([...listed, ...availableTags, ...selected]);
    const selectedKeys = new Set(selected.map((tag) => tag.toLowerCase()));
    const name = search.trim();
    const query = name.toLowerCase();
    const matches = options.filter((tag) => tag.toLowerCase().includes(query));
    const canCreate =
        allowCreate && name !== '' && !options.some((tag) => tag.toLowerCase() === query);
    const changeSearch = (event: ChangeEvent<HTMLInputElement>) =>
        setSearch(event.currentTarget.value);
    const changeSelection = (event: ChangeEvent<HTMLInputElement>) => {
        const { value, checked } = event.currentTarget;
        if (checked) {
            onChange(normalizeTags([...selected, value]));
            return;
        }
        onChange(selected.filter((tag) => tag.toLowerCase() !== value.toLowerCase()));
    };
    const createTag = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!canCreate) {
            return;
        }
        setListed(normalizeTags([...listed, name]));
        onChange(normalizeTags([...selected, name]));
        setSearch('');
        searchInput.current?.focus();
    };

    return createPortal(
        <div
            ref={popup}
            role="dialog"
            aria-label={title}
            className={`${menuStyles.contextMenu} ${styles.editor}`}
        >
            <div className={`${menuStyles.header} ${styles.heading}`}>
                <span role="heading" aria-level={2}>
                    {title}
                </span>
            </div>
            <form className={styles.picker} onSubmit={createTag}>
                <input
                    ref={searchInput}
                    className={styles.search}
                    type="search"
                    aria-label="Search tags"
                    placeholder={allowCreate ? 'Find or create a tag' : 'Find a tag'}
                    value={search}
                    onChange={changeSearch}
                />
                <div className={styles.options}>
                    {matches.map((tag) => (
                        <label key={tag} className={`${menuStyles.row} ${styles.option}`}>
                            <input
                                type="checkbox"
                                value={tag}
                                checked={selectedKeys.has(tag.toLowerCase())}
                                onChange={changeSelection}
                            />
                            <span className={styles.pill} data-tone={documentTagTone(tag)}>
                                {tag}
                            </span>
                            <span className={styles.check} aria-hidden="true">
                                {selectedKeys.has(tag.toLowerCase()) && (
                                    <Check size={16} strokeWidth={1.5} />
                                )}
                            </span>
                        </label>
                    ))}
                    {matches.length === 0 && !canCreate && (
                        <p className={styles.empty}>
                            {options.length === 0 ? 'No tags yet.' : 'No matching tags.'}
                        </p>
                    )}
                </div>
                {canCreate && (
                    <button className={`${menuStyles.row} ${styles.create}`} type="submit">
                        <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
                        Create “{name}”
                    </button>
                )}
            </form>
        </div>,
        document.body
    );
};
