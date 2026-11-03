export interface Suggestion {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    /** Current context-specific reason; never part of the search cache. */
    unavailable?: string;
}

type Metadata = Pick<Suggestion, 'id' | 'name' | 'description'>;
const CACHE_LIMIT = 64;
const RESULT_LIMIT = 8;
export const SEARCH_DELAY_MS = 75;
export const LARGE_CATALOGUE_SIZE = 5000;

/** Cache only matching positions and text relevance, never execution permissions. */
export function createCommandSearch(catalogue: Metadata[]) {
    const entries = catalogue.map(({ id, name, description }) => ({
        id: id.toLowerCase(),
        name: name.toLowerCase(),
        text: `${id} ${name} ${description}`.toLowerCase()
    }));
    const cache = new Map<string, number[][]>();
    const normalize = (query: string) => query.trim().toLowerCase();
    const has = (query: string) => cache.has(normalize(query));
    const search = (input: string) => {
        const query = normalize(input);
        const found = cache.get(query);
        if (found) {
            cache.delete(query);
            cache.set(query, found);

            return found;
        }

        const groups: number[][] = [[], [], []];
        entries.forEach((entry, index) => {
            if (!entry.text.includes(query)) {
                return;
            }

            const rank =
                entry.id === query || entry.name === query
                    ? 0
                    : entry.name.startsWith(query)
                      ? 1
                      : 2;
            groups[rank].push(index);
        });
        cache.set(query, groups);
        if (cache.size > CACHE_LIMIT) {
            cache.delete(cache.keys().next().value!);
        }

        return groups;
    };

    return { has, search };
}

/** Apply current availability within each relevance group, preserving catalogue order. */
export function availableMatches(groups: number[][], suggestions: Suggestion[]): Suggestion[] {
    const result: Suggestion[] = [];
    for (const group of groups) {
        for (const enabled of [true, false]) {
            for (const index of group) {
                const item = suggestions[index];
                if (item.enabled !== enabled) {
                    continue;
                }
                result.push(item);
                if (result.length === RESULT_LIMIT) {
                    return result;
                }
            }
        }
    }

    return result;
}

export function scheduleSearch(search: () => void): () => void {
    const timer = setTimeout(search, SEARCH_DELAY_MS);

    return () => clearTimeout(timer);
}
