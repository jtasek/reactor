import React, { ChangeEvent, FC, FormEvent, MouseEvent, useRef, useState } from 'react';
import { documentTagTone, normalizeTags } from 'src/app/documentList';
import { TAG_TONES, type TagTone } from 'src/app/tagTones';
import { createPortal } from 'react-dom';
import { Check, Plus } from 'lucide-react';
import menuStyles from '../ContextMenu/styles.css';
import { useAnchoredPopup } from './useAnchoredPopup';
import styles from './tags.css';

interface Props {
    anchor: HTMLButtonElement;
    title: string;
    availableTags: string[];
    tagTones: Readonly<Record<string, string>>;
    selectedTags: string[];
    onChange: (tags: string[]) => void;
    onTone: (tag: string, tone: TagTone) => void;
    onClose: () => void;
    allowCreate?: boolean;
}

export const TagPicker: FC<Props> = ({
    anchor,
    title,
    availableTags,
    tagTones,
    selectedTags,
    onChange,
    onTone,
    onClose,
    allowCreate = false
}) => {
    const [search, setSearch] = useState('');
    const [coloring, setColoring] = useState<string | null>(null);
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
    const toggleColoring = (tag: string) => setColoring(coloring === tag ? null : tag);
    const chooseTone = (event: MouseEvent<HTMLButtonElement>, tag: string, tone: TagTone) => {
        // Focus goes back to the tag's color button as the swatches close.
        event.currentTarget
            .closest(`.${styles.optionRow}`)
            ?.querySelector<HTMLButtonElement>(`.${styles.toneButton}`)
            ?.focus();
        onTone(tag, tone);
        setColoring(null);
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
                    {matches.map((tag) => {
                        const tone = documentTagTone(tag, tagTones);

                        return (
                            <div key={tag} className={styles.optionRow}>
                                <button
                                    type="button"
                                    className={styles.toneButton}
                                    data-tone={tone}
                                    aria-label={`Color of ${tag}`}
                                    title={`Color of ${tag}`}
                                    aria-expanded={coloring === tag}
                                    onClick={() => toggleColoring(tag)}
                                />
                                <label className={`${menuStyles.row} ${styles.option}`}>
                                    <input
                                        type="checkbox"
                                        value={tag}
                                        checked={selectedKeys.has(tag.toLowerCase())}
                                        onChange={changeSelection}
                                    />
                                    <span className={styles.pill} data-tone={tone}>
                                        {tag}
                                    </span>
                                    <span className={styles.check} aria-hidden="true">
                                        {selectedKeys.has(tag.toLowerCase()) && (
                                            <Check size={16} strokeWidth={1.5} />
                                        )}
                                    </span>
                                </label>
                                {coloring === tag && (
                                    <div
                                        className={styles.tones}
                                        role="radiogroup"
                                        aria-label={`Colors for ${tag}`}
                                    >
                                        {TAG_TONES.map((option) => (
                                            <button
                                                key={option}
                                                type="button"
                                                role="radio"
                                                className={styles.toneSwatch}
                                                data-tone={option}
                                                aria-checked={option === tone}
                                                aria-label={option}
                                                title={option}
                                                onClick={(event) => chooseTone(event, tag, option)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
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
