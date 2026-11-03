import {
    availableMatches,
    createCommandSearch,
    sameMetadata,
    scheduleSearch,
    SEARCH_DELAY_MS,
    shouldDelay,
    submitCandidate
} from 'src/ui/components/CommandLine/search';
import type { Suggestion } from 'src/ui/components/CommandLine/search';

const suggestions: Suggestion[] = [
    { id: 'move', name: 'Move', description: 'Move selection', enabled: false },
    { id: 'move-left', name: 'Move left', description: 'Nudge left', enabled: true },
    { id: 'tool', name: 'Select tool', description: 'Move artwork', enabled: true }
];

it('preserves relevance, enabled tie-breaking and catalogue order', () => {
    const index = createCommandSearch(suggestions);
    expect(availableMatches(index.search('move'), suggestions).map(({ id }) => id)).toEqual([
        'move',
        'move-left',
        'tool'
    ]);
    expect(availableMatches(index.search(''), suggestions).map(({ id }) => id)).toEqual([
        'move-left',
        'tool',
        'move'
    ]);
});

it('reuses normalized queries but applies current availability and reasons', () => {
    const index = createCommandSearch(suggestions);
    const result = index.search(' MOVE ');
    expect(index.search('move')).toBe(result);
    const changed = suggestions.map((item) => ({
        ...item,
        enabled: !item.enabled,
        unavailable: 'The target is locked.'
    }));
    expect(availableMatches(index.search(''), changed).map(({ id }) => id)).toEqual([
        'move',
        'move-left',
        'tool'
    ]);
    expect(availableMatches(result, changed)[0].enabled).toBe(true);
    expect(availableMatches(result, changed)[1].unavailable).toBe('The target is locked.');
});

it('bounds the cache and keeps recently used queries', () => {
    const index = createCommandSearch(suggestions);
    for (let i = 0; i < 64; i++) {
        index.search(`query-${i}`);
    }
    index.search('query-0');
    index.search('another');
    expect(index.has('query-0')).toBe(true);
    expect(index.has('query-1')).toBe(false);
});

it('starts with a fresh index when catalogue metadata changes', () => {
    const old = createCommandSearch(suggestions);
    old.search('new');
    const changed = [
        ...suggestions,
        { id: 'new', name: 'New action', description: '', enabled: true }
    ];
    const next = createCommandSearch(changed);
    expect(next.has('new')).toBe(false);
    expect(availableMatches(next.search('new'), changed).map(({ id }) => id)).toEqual(['new']);
});

it('cancels superseded or closed searches and executes only the latest query', () => {
    vi.useFakeTimers();
    try {
        const search = vi.fn();
        const first = scheduleSearch(() => search('old'));
        first();
        scheduleSearch(() => search('latest'));
        vi.advanceTimersByTime(SEARCH_DELAY_MS - 1);
        expect(search).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(search.mock.calls).toEqual([['latest']]);
        const closing = scheduleSearch(() => search('closed'));
        closing();
        vi.runAllTimers();
        expect(search).toHaveBeenCalledTimes(1);
    } finally {
        vi.useRealTimers();
    }
});

it('matches the existing ranking across large catalogues and changing guards', () => {
    const catalogue = Array.from({ length: 10000 }, (_, i) => ({
        ...suggestions[i % suggestions.length],
        id: `action-${i}`,
        enabled: i % 4 === 0
    }));
    const index = createCommandSearch(catalogue);
    for (const query of ['', 'move', 'left', 'action-99', 'missing']) {
        const rank = (item: Suggestion) =>
            (item.id.toLowerCase() === query || item.name.toLowerCase() === query
                ? 100
                : item.name.toLowerCase().startsWith(query)
                  ? 20
                  : 0) + Number(item.enabled);
        const expected = catalogue
            .filter(({ id, name, description }) =>
                `${id} ${name} ${description}`.toLowerCase().includes(query)
            )
            .sort((a, b) => rank(b) - rank(a))
            .slice(0, 8);
        expect(availableMatches(index.search(query), catalogue)).toEqual(expected);
    }
});

it('treats a rebuilt catalogue with the same text as unchanged', () => {
    const copy = suggestions.map((item) => ({ ...item, enabled: !item.enabled }));
    expect(sameMetadata(suggestions, copy)).toBe(true);
    expect(sameMetadata(suggestions, copy.slice(1))).toBe(false);
    expect(
        sameMetadata(
            suggestions,
            copy.map((item, i) => (i === 2 ? { ...item, description: 'Changed' } : item))
        )
    ).toBe(false);
});

it('waits only for uncached partial queries in large catalogues', () => {
    const index = createCommandSearch(suggestions);
    // Lower the threshold so the three-entry fixture counts as large.
    const delay = (query: string, active = true) =>
        shouldDelay(suggestions, query, active, index.has, 3);
    expect(delay('mov')).toBe(true);
    expect(delay('mov', false)).toBe(false);
    expect(delay('')).toBe(false);
    expect(delay('move left')).toBe(false);
    expect(delay('select tool')).toBe(false);
    index.search('mov');
    expect(delay(' MOV ')).toBe(false);
    expect(shouldDelay(suggestions, 'nudge', true, index.has)).toBe(false);
});

it('Enter while waiting picks the latest input, not the hidden list', () => {
    const index = createCommandSearch(suggestions);
    const resolve = () => availableMatches(index.search('nudge'), suggestions);
    const stale = [suggestions[2]];
    const base = { matches: stale, chosenIndex: 0, choosing: true, resolve };
    expect(submitCandidate({ ...base, waiting: true, directInput: false })?.id).toBe('move-left');
    expect(submitCandidate({ ...base, waiting: true, directInput: true })).toBeUndefined();
    expect(submitCandidate({ ...base, waiting: false, directInput: false })?.id).toBe('tool');
    expect(
        submitCandidate({ ...base, waiting: false, directInput: false, choosing: false })
    ).toBeUndefined();
});

it('a scheduled search fills the cache so the next render stops waiting', () => {
    vi.useFakeTimers();
    try {
        const index = createCommandSearch(suggestions);
        const delay = () => shouldDelay(suggestions, 'left', true, index.has, 3);
        expect(delay()).toBe(true);
        scheduleSearch(() => index.search('left'));
        vi.advanceTimersByTime(SEARCH_DELAY_MS);
        expect(delay()).toBe(false);
        expect(availableMatches(index.search('left'), suggestions).map(({ id }) => id)).toEqual([
            'move-left'
        ]);
    } finally {
        vi.useRealTimers();
    }
});
