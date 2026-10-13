import type { Document } from './types';

export type DocumentDateFilter = 'all' | 'today' | 'week' | 'month';

export interface DocumentListFilters {
    query: string;
    date: DocumentDateFilter;
    tags: readonly string[];
}

const FILTER_DAYS = { today: 1, week: 7, month: 30 };
const TAG_TONES = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray'] as const;

const tagKey = (tag: string) => tag.trim().toLowerCase();

export const normalizeTags = (tags: string[]): string[] => {
    const seen = new Set<string>();

    return tags
        .map((tag) => tag.trim())
        .filter((tag) => {
            const key = tagKey(tag);

            if (!key || seen.has(key)) {
                return false;
            }

            seen.add(key);
            return true;
        });
};

const dayStart = (date: Date, offset = 0) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);

export function matchesDocument(
    document: Pick<Document, 'name' | 'modified' | 'tags'>,
    filters: DocumentListFilters,
    referenceDate: Date
): boolean {
    if (!document.name.toLowerCase().includes(filters.query.trim().toLowerCase())) {
        return false;
    }

    const documentTags = new Set(document.tags.map(tagKey));

    if (filters.tags.length && !filters.tags.some((tag) => documentTags.has(tagKey(tag)))) {
        return false;
    }

    if (filters.date === 'all') {
        return true;
    }

    // Count local calendar days, including today, rather than elapsed 24-hour periods.
    return (
        document.modified >= dayStart(referenceDate, 1 - FILTER_DAYS[filters.date]) &&
        document.modified < dayStart(referenceDate, 1)
    );
}

export function documentModifiedLabel(
    modified: Date,
    referenceDate: Date,
    locale?: string
): string {
    const modifiedDay = dayStart(modified).getTime();

    if (modifiedDay === dayStart(referenceDate).getTime()) {
        return 'Today';
    }

    if (modifiedDay === dayStart(referenceDate, -1).getTime()) {
        return 'Yesterday';
    }

    return modified.toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric',
        ...(modified.getFullYear() === referenceDate.getFullYear() ? {} : { year: 'numeric' })
    });
}

/** Assign distinct tones from the full tag catalog, independent of filtering or document order. */
export function documentTagTone(name: string, availableTags: string[]): (typeof TAG_TONES)[number] {
    const names = [...new Set([...availableTags, name].map(tagKey))].sort();
    return TAG_TONES[names.indexOf(tagKey(name)) % TAG_TONES.length];
}
