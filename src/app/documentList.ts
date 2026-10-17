import type { Document, DocumentsLayout } from './types';
import { isTagTone, TAG_TONES, tagKey, type TagTone } from './tagTones';

export type DocumentDateFilter = 'all' | 'today' | 'week' | 'month';

export interface DocumentListFilters {
    query: string;
    date: DocumentDateFilter;
    tags: readonly string[];
}

const FILTER_DAYS = { today: 1, week: 7, month: 30 };
const DAY_MS = 24 * 60 * 60 * 1000;

/** How many days Recently Deleted keeps a document before deleting it for good. */
export const RECENTLY_DELETED_DAYS = 30;

export const DOCUMENTS_LAYOUT_KEY = 'reactor:documents-layout';

export const readDocumentsLayout = (value: unknown): DocumentsLayout =>
    value === 'list' ? 'list' : 'cards';

/**
 * The whole days left before a document moved to Recently Deleted is deleted for good,
 * counted from `now`, which may be a little older than the move.
 */
export const daysLeftInRecentlyDeleted = (deleted: Date, now: Date): number =>
    Math.min(
        RECENTLY_DELETED_DAYS,
        Math.max(
            0,
            Math.ceil((deleted.getTime() + RECENTLY_DELETED_DAYS * DAY_MS - now.getTime()) / DAY_MS)
        )
    );

export const deletedForGood = (deleted: Date, now: Date): boolean =>
    daysLeftInRecentlyDeleted(deleted, now) === 0;

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

/**
 * A tag's tone: the one chosen for it, else one from its name alone, so adding or
 * removing other tags never changes it.
 */
export function documentTagTone(
    name: string,
    chosen: Readonly<Record<string, string>> = {}
): TagTone {
    const key = tagKey(name);
    const picked = chosen[key];

    if (isTagTone(picked)) {
        return picked;
    }

    let hash = 0;

    for (const character of key) {
        hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0;
    }

    return TAG_TONES[hash % TAG_TONES.length];
}

/** The tone chosen for each tag across documents, the latest edited document's winning. */
export function chosenTagTones(
    documents: readonly Pick<Document, 'modified' | 'tags' | 'tagTones'>[]
): Record<string, string> {
    const chosen: Record<string, string> = {};

    [...documents]
        .sort((first, second) => first.modified.getTime() - second.modified.getTime())
        .forEach(({ tags, tagTones }) =>
            tags.forEach((tag) => {
                const tone = tagTones[tagKey(tag)];

                if (tone) {
                    chosen[tagKey(tag)] = tone;
                }
            })
        );

    return chosen;
}
