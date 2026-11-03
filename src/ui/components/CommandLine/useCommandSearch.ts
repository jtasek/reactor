import { useEffect, useMemo, useState } from 'react';
import {
    availableMatches,
    createCommandSearch,
    LARGE_CATALOGUE_SIZE,
    scheduleSearch
} from './search';
import type { Suggestion } from './search';

export function useCommandSearch(suggestions: Suggestion[], query: string, active: boolean) {
    const catalogue = useMemo(
        () =>
            JSON.stringify(
                suggestions.map(({ id, name, description }) => ({ id, name, description }))
            ),
        [suggestions]
    );
    const index = useMemo(() => createCommandSearch(JSON.parse(catalogue)), [catalogue]);
    const [, refresh] = useState(0);
    const exact = suggestions.some(
        (item) => item.id.toLowerCase() === query || item.name.toLowerCase() === query
    );
    const waiting =
        active &&
        Boolean(query) &&
        !exact &&
        suggestions.length >= LARGE_CATALOGUE_SIZE &&
        !index.has(query);

    useEffect(() => {
        if (!waiting) {
            return;
        }

        return scheduleSearch(() => {
            index.search(query);
            refresh((value) => value + 1);
        });
    }, [index, query, waiting]);

    const resolve = () => availableMatches(index.search(query), suggestions);

    return { matches: active && !waiting ? resolve() : [], waiting, resolve };
}
