import React, { ChangeEvent, FC, FormEvent, useEffect, useRef, useState } from 'react';
import { documentTagTone, normalizeTags } from 'src/app/documentList';
import { createPortal } from 'react-dom';
import { Check, Plus } from 'lucide-react';
import menuStyles from '../ContextMenu/styles.css';
import dialogStyles from '../Dialog/styles.css';
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
    const close = () => {
        anchor.focus();
        onClose();
    };
    const searchInput = useRef<HTMLInputElement>(null);
    const incoming = normalizeTags(selectedTags);
    const source = JSON.stringify(incoming);
    const [draft, setDraft] = useState({ source, tags: incoming });
    const selected = draft.tags;
    useEffect(() => {
        setDraft((current) => {
            const tags = normalizeTags(selectedTags);
            const source = JSON.stringify(tags);
            return current.source === source ? current : { source, tags };
        });
    }, [selectedTags]);

    const options = normalizeTags([...availableTags, ...selected]);
    const selectedKeys = new Set(selected.map((tag) => tag.toLowerCase()));
    const name = search.trim();
    const query = name.toLowerCase();
    const matches = options.filter((tag) => tag.toLowerCase().includes(query));
    const canCreate =
        allowCreate && name !== '' && !options.some((tag) => tag.toLowerCase() === query);
    const changeSearch = (event: ChangeEvent<HTMLInputElement>) =>
        setSearch(event.currentTarget.value);
    const saveSelection = () => {
        onChange(selected);
        close();
    };
    const changeSelection = (event: ChangeEvent<HTMLInputElement>) => {
        const { value, checked } = event.currentTarget;
        if (checked) {
            setDraft({ source, tags: normalizeTags([...selected, value]) });
            return;
        }
        setDraft({
            source,
            tags: selected.filter((tag) => tag.toLowerCase() !== value.toLowerCase())
        });
    };
    const createTag = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!canCreate) {
            return;
        }
        setDraft({ source, tags: normalizeTags([...selected, name]) });
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
                            <span className={styles.pill} data-tone={documentTagTone(tag, options)}>
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
            <div className={menuStyles.divider} />
            <div className={`${dialogStyles.actions} ${styles.pickerActions}`}>
                <button type="button" onClick={close}>
                    Cancel
                </button>
                <button type="button" data-variant="primary" onClick={saveSelection}>
                    Done
                </button>
            </div>
        </div>,
        document.body
    );
};
