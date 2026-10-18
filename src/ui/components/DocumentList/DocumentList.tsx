import React, { ChangeEvent, FC, useCallback, useEffect, useRef, useState } from 'react';
import type { Document, DocumentsLayout } from 'src/app/types';
import type { TagTone } from 'src/app/tagTones';
import {
    ArrowUpDown,
    CalendarDays,
    ChevronDown,
    LayoutGrid,
    List,
    Plus,
    Search,
    Tag,
    Trash2,
    X
} from 'lucide-react';
import { useActions } from 'src/app/hooks';
import {
    DocumentDateFilter,
    RECENTLY_DELETED_DAYS,
    chosenTagTones,
    documentTagTone,
    matchesDocument,
    normalizeTags
} from 'src/app/documentList';
import { DocumentCard } from './DocumentCard';
import { DocumentsBar } from './DocumentsBar';
import { FilterMenu } from './FilterMenu';
import tagStyles from './tags.css';
import styles from './styles.css';

interface Props {
    documents: Pick<
        Document,
        'id' | 'name' | 'created' | 'modified' | 'deleted' | 'tags' | 'tagTones'
    >[];
    currentDocumentId: string;
    layout: DocumentsLayout;
    onLayout: (layout: DocumentsLayout) => void;
    onCreate: () => void;
    onTagTone: (tag: string, tone: TagTone) => void;
}

type DocumentSort = 'modified' | 'created' | 'name';

const SORT_OPTIONS: { value: DocumentSort; label: string }[] = [
    { value: 'modified', label: 'Date edited' },
    { value: 'created', label: 'Date created' },
    { value: 'name', label: 'Name' }
];

type Listed = Props['documents'][number];

/** Newest first by date, A to Z by name; ties go by name. */
const SORTS: Record<DocumentSort, (first: Listed, second: Listed) => number> = {
    modified: (first, second) =>
        second.modified.getTime() - first.modified.getTime() ||
        first.name.localeCompare(second.name),
    created: (first, second) =>
        second.created.getTime() - first.created.getTime() || first.name.localeCompare(second.name),
    name: (first, second) =>
        first.name.localeCompare(second.name, undefined, { numeric: true }) ||
        second.modified.getTime() - first.modified.getTime()
};

/** How long the offer to undo moving a document to Recently Deleted stays. */
const UNDO_DELETE_MS = 8000;

const DATE_OPTIONS: { value: DocumentDateFilter; label: string }[] = [
    { value: 'all', label: 'Any time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'Past 7 days' },
    { value: 'month', label: 'Past 30 days' }
];

export const DocumentList: FC<Props> = ({
    documents,
    currentDocumentId,
    layout,
    onLayout,
    onCreate,
    onTagTone
}) => {
    const { restoreDocument } = useActions();
    const [showDeleted, setShowDeleted] = useState(false);
    const [trashed, setTrashed] = useState<{ id: string; name: string } | null>(null);
    const undoButton = useRef<HTMLButtonElement>(null);
    const [query, setQuery] = useState('');
    const [date, setDate] = useState<DocumentDateFilter>('all');
    const [tags, setTags] = useState<string[]>([]);
    const [sort, setSort] = useState<DocumentSort>('modified');
    const [filterMenu, setFilterMenu] = useState<'sort' | 'date' | 'tags' | null>(null);
    const sortButton = useRef<HTMLButtonElement>(null);
    const dateButton = useRef<HTMLButtonElement>(null);
    const tagsButton = useRef<HTMLButtonElement>(null);
    const [now, setNow] = useState(() => new Date());
    const tagTones = chosenTagTones(documents);
    const availableTags = normalizeTags(documents.flatMap((document) => document.tags)).sort(
        (first, second) => first.localeCompare(second)
    );
    const deletedCount = documents.filter(({ deleted }) => deleted).length;
    const visibleDocuments = documents
        .filter(({ deleted }) => Boolean(deleted) === showDeleted)
        .filter((document) => matchesDocument(document, { query, date, tags }, now))
        .sort(SORTS[sort]);
    const sortLabel = SORT_OPTIONS.find(({ value }) => value === sort)?.label;
    const dateLabel = DATE_OPTIONS.find(({ value }) => value === date)?.label;
    const filtered = query !== '' || date !== 'all' || tags.length > 0;

    // The labels and date filters change only as a day begins.
    useEffect(() => {
        const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const timer = window.setTimeout(() => setNow(new Date()), midnight.getTime() - Date.now());

        return () => window.clearTimeout(timer);
    }, [now]);

    // The offer to undo goes after a while; its button takes the focus of the card that went.
    useEffect(() => {
        if (!trashed) {
            return;
        }

        undoButton.current?.focus();
        const timer = window.setTimeout(() => setTrashed(null), UNDO_DELETE_MS);

        return () => window.clearTimeout(timer);
    }, [trashed]);

    const undoDelete = () => {
        if (trashed && documents.some(({ id }) => id === trashed.id)) {
            restoreDocument(trashed.id);
        }
        setTrashed(null);
    };
    const toggleDeleted = () => {
        setShowDeleted(!showDeleted);
        setTrashed(null);
    };
    const search = (event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value);
    const changeDate = (selected: string) => {
        const option = DATE_OPTIONS.find(({ value }) => value === selected);

        if (option) {
            setDate(option.value);
        }
    };
    const changeSort = (selected: string) => {
        const option = SORT_OPTIONS.find(({ value }) => value === selected);

        if (option) {
            setSort(option.value);
        }
    };
    const clearFilters = () => {
        setQuery('');
        setDate('all');
        setTags([]);
    };
    const filterTag = (tag: string) => setTags([tag]);
    const closeFilterMenu = useCallback(() => setFilterMenu(null), []);
    const toggleTag = (tag: string) =>
        setTags((current) =>
            current.some((value) => value.toLowerCase() === tag.toLowerCase())
                ? current.filter((value) => value.toLowerCase() !== tag.toLowerCase())
                : [...current, tag]
        );

    return (
        <main className={styles.documentList}>
            <div className={styles.panel}>
                <DocumentsBar />
                <header className={styles.header}>
                    <div>
                        <h1>{showDeleted ? 'Recently Deleted' : 'Documents'}</h1>
                        {showDeleted && (
                            <p className={styles.subtitle}>
                                Documents here are deleted for good {RECENTLY_DELETED_DAYS} days
                                after they were moved here.
                            </p>
                        )}
                    </div>
                    <button className={styles.newButton} type="button" onClick={onCreate}>
                        <Plus size={18} strokeWidth={1.5} aria-hidden="true" />
                        New document
                    </button>
                </header>
                <div className={styles.browseControls}>
                    <label className={styles.search}>
                        <Search size={18} strokeWidth={1.5} aria-hidden="true" />
                        <input
                            type="search"
                            aria-label="Search documents"
                            placeholder="Search documents"
                            value={query}
                            onChange={search}
                        />
                    </label>
                    <button
                        ref={dateButton}
                        type="button"
                        className={styles.dateFilter}
                        aria-label={`Last edited: ${dateLabel}`}
                        aria-haspopup="menu"
                        aria-expanded={filterMenu === 'date'}
                        onClick={() => setFilterMenu(filterMenu === 'date' ? null : 'date')}
                    >
                        <CalendarDays size={16} strokeWidth={1.5} aria-hidden="true" />
                        {dateLabel}
                        <ChevronDown size={14} strokeWidth={1.5} aria-hidden="true" />
                    </button>
                    <button
                        ref={tagsButton}
                        className={styles.tagFilter}
                        type="button"
                        aria-haspopup="menu"
                        aria-expanded={filterMenu === 'tags'}
                        aria-label="Filter by tags"
                        onClick={() => setFilterMenu(filterMenu === 'tags' ? null : 'tags')}
                    >
                        <Tag size={18} strokeWidth={1.5} aria-hidden="true" />
                        Tags{tags.length > 0 && ` (${tags.length})`}
                    </button>
                    {(deletedCount > 0 || showDeleted) && (
                        <button
                            className={styles.tagFilter}
                            type="button"
                            aria-pressed={showDeleted}
                            onClick={toggleDeleted}
                        >
                            <Trash2 size={18} strokeWidth={1.5} aria-hidden="true" />
                            Recently Deleted{deletedCount > 0 && ` (${deletedCount})`}
                        </button>
                    )}
                    <button
                        ref={sortButton}
                        type="button"
                        className={styles.dateFilter}
                        aria-label={`Sort by: ${sortLabel}`}
                        aria-haspopup="menu"
                        aria-expanded={filterMenu === 'sort'}
                        onClick={() => setFilterMenu(filterMenu === 'sort' ? null : 'sort')}
                    >
                        <ArrowUpDown size={16} strokeWidth={1.5} aria-hidden="true" />
                        {sortLabel}
                    </button>
                    <div className={styles.layoutToggle} role="group" aria-label="Document layout">
                        <button
                            type="button"
                            className={styles.iconButton}
                            title="Card view"
                            aria-label="Card view"
                            aria-pressed={layout === 'cards'}
                            onClick={() => onLayout('cards')}
                        >
                            <LayoutGrid size={18} strokeWidth={1.5} aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            className={styles.iconButton}
                            title="List view"
                            aria-label="List view"
                            aria-pressed={layout === 'list'}
                            onClick={() => onLayout('list')}
                        >
                            <List size={18} strokeWidth={1.5} aria-hidden="true" />
                        </button>
                    </div>
                </div>
                <div className={styles.filterSummary}>
                    {tags.length > 1 && <span>Any tag</span>}
                    {tags.map((tag) => (
                        <button
                            key={tag}
                            className={tagStyles.pill}
                            data-tone={documentTagTone(tag, tagTones)}
                            type="button"
                            aria-label={`Remove ${tag} filter`}
                            onClick={() => setTags(tags.filter((selected) => selected !== tag))}
                        >
                            {tag}
                            <X size={12} strokeWidth={1.5} aria-hidden="true" />
                        </button>
                    ))}
                    {filtered && (
                        <button
                            className={styles.clearFilters}
                            type="button"
                            onClick={clearFilters}
                        >
                            Clear filters
                        </button>
                    )}
                    <span className={styles.resultCount} role="status">
                        {visibleDocuments.length}{' '}
                        {visibleDocuments.length === 1 ? 'document' : 'documents'}
                    </span>
                </div>
                <ul className={styles.grid} data-layout={layout} aria-label="Documents">
                    {visibleDocuments.map(({ id }) => (
                        <DocumentCard
                            key={id}
                            documentId={id}
                            current={id === currentDocumentId}
                            availableTags={availableTags}
                            tagTones={tagTones}
                            onFilterTag={filterTag}
                            onTagTone={onTagTone}
                            onTrashed={setTrashed}
                            now={now}
                        />
                    ))}
                </ul>
                {visibleDocuments.length === 0 && (
                    <div className={styles.empty}>
                        <h2>
                            {showDeleted && !filtered
                                ? 'Recently Deleted is empty'
                                : 'No documents found'}
                        </h2>
                        {filtered && (
                            <button type="button" onClick={clearFilters}>
                                Clear filters
                            </button>
                        )}
                    </div>
                )}
                <div className={styles.toastRegion} role="status">
                    {trashed && (
                        <div className={styles.toast}>
                            <span>Moved “{trashed.name}” to Recently Deleted</span>
                            <button ref={undoButton} type="button" onClick={undoDelete}>
                                Undo
                            </button>
                        </div>
                    )}
                </div>
                {filterMenu === 'tags' && tagsButton.current && (
                    <FilterMenu
                        anchor={tagsButton.current}
                        title="Filter by tags"
                        options={availableTags.map((tag) => ({
                            value: tag,
                            label: tag,
                            tone: documentTagTone(tag, tagTones)
                        }))}
                        selected={tags}
                        multiple
                        onSelect={toggleTag}
                        onClose={closeFilterMenu}
                    />
                )}
                {filterMenu === 'sort' && sortButton.current && (
                    <FilterMenu
                        anchor={sortButton.current}
                        title="Sort by"
                        options={SORT_OPTIONS}
                        selected={[sort]}
                        onSelect={changeSort}
                        onClose={closeFilterMenu}
                    />
                )}
                {filterMenu === 'date' && dateButton.current && (
                    <FilterMenu
                        anchor={dateButton.current}
                        title="Last edited"
                        options={DATE_OPTIONS}
                        selected={[date]}
                        onSelect={changeDate}
                        onClose={closeFilterMenu}
                    />
                )}
            </div>
        </main>
    );
};
