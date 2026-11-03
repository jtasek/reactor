import { useEffect, useRef, useState } from 'react';
import {
    availableMatches,
    createCommandSearch,
    sameMetadata,
    scheduleSearch,
    shouldDelay
} from './search';
import type { Suggestion } from './search';

export function useCommandSearch(suggestions: Suggestion[], query: string, active: boolean) {
    // The caller builds a new array each render, so compare the searchable text
    // entry by entry instead of by identity; rebuild only when it changed.
    const built = useRef<{
        catalogue: Suggestion[];
        index: ReturnType<typeof createCommandSearch>;
    }>(undefined);
    if (!built.current || !sameMetadata(built.current.catalogue, suggestions)) {
        built.current = { catalogue: suggestions, index: createCommandSearch(suggestions) };
    }
    const { index } = built.current;
    const [, refresh] = useState(0);
    const waiting = shouldDelay(suggestions, query, active, index.has);

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
