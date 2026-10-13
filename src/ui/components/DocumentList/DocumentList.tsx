import React, { ChangeEvent, FC, useCallback, useEffect, useRef, useState } from 'react';
import type { Document } from 'src/app/types';
import { ChevronDown, LayoutGrid, List, Plus, Search, Tag, X } from 'lucide-react';
import {
    DocumentDateFilter,
    documentTagTone,
    matchesDocument,
    normalizeTags
} from 'src/app/documentList';
import { DocumentCard } from './DocumentCard';
import { FilterMenu } from './FilterMenu';
import tagStyles from './tags.css';
import styles from './styles.css';

interface Props {
    documents: Pick<Document, 'id' | 'name' | 'modified' | 'tags'>[];
    currentDocumentId: string;
    onCreate: () => void;
}

const DATE_OPTIONS: { value: DocumentDateFilter; label: string }[] = [
    { value: 'all', label: 'Any time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'Past 7 days' },
    { value: 'month', label: 'Past 30 days' }
];

export const DocumentList: FC<Props> = ({ documents, currentDocumentId, onCreate }) => {
    const [layout, setLayout] = useState<'cards' | 'list'>('cards');
    const [query, setQuery] = useState('');
    const [date, setDate] = useState<DocumentDateFilter>('all');
    const [tags, setTags] = useState<string[]>([]);
    const [filterMenu, setFilterMenu] = useState<'date' | 'tags' | null>(null);
    const dateButton = useRef<HTMLButtonElement>(null);
    const tagsButton = useRef<HTMLButtonElement>(null);
    const [now, setNow] = useState(() => new Date());
    const availableTags = normalizeTags(documents.flatMap((document) => document.tags)).sort(
        (first, second) => first.localeCompare(second)
    );
    const visibleDocuments = documents
        .filter((document) => matchesDocument(document, { query, date, tags }, now))
        .sort(
            (first, second) =>
                second.modified.getTime() - first.modified.getTime() ||
                first.name.localeCompare(second.name)
        );
    const dateLabel = DATE_OPTIONS.find(({ value }) => value === date)?.label;
    const filtered = query !== '' || date !== 'all' || tags.length > 0;

    // The labels and date filters change only as a day begins.
    useEffect(() => {
        const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const timer = window.setTimeout(() => setNow(new Date()), midnight.getTime() - Date.now());

        return () => window.clearTimeout(timer);
    }, [now]);

    const search = (event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value);
    const changeDate = (selected: string) => {
        const option = DATE_OPTIONS.find(({ value }) => value === selected);

        if (option) {
            setDate(option.value);
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
                <header className={styles.header}>
                    <h1>Documents</h1>
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
                    <div className={styles.layoutToggle} role="group" aria-label="Document layout">
                        <button
                            type="button"
                            className={styles.iconButton}
                            title="Card view"
                            aria-label="Card view"
                            aria-pressed={layout === 'cards'}
                            onClick={() => setLayout('cards')}
                        >
                            <LayoutGrid size={18} strokeWidth={1.5} aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            className={styles.iconButton}
                            title="List view"
                            aria-label="List view"
                            aria-pressed={layout === 'list'}
                            onClick={() => setLayout('list')}
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
                            data-tone={documentTagTone(tag)}
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
                            onFilterTag={filterTag}
                            now={now}
                        />
                    ))}
                </ul>
                {visibleDocuments.length === 0 && (
                    <div className={styles.empty}>
                        <h2>No documents found</h2>
                        <button type="button" onClick={clearFilters}>
                            Clear filters
                        </button>
                    </div>
                )}
                {filterMenu === 'tags' && tagsButton.current && (
                    <FilterMenu
                        anchor={tagsButton.current}
                        title="Filter by tags"
                        options={availableTags.map((tag) => ({
                            value: tag,
                            label: tag,
                            tone: documentTagTone(tag)
                        }))}
                        selected={tags}
                        multiple
                        onSelect={toggleTag}
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
