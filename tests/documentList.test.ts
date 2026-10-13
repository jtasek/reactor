import {
    chosenTagTones,
    documentModifiedLabel,
    documentTagTone,
    matchesDocument,
    normalizeTags,
    type DocumentListFilters
} from 'src/app/documentList';

const referenceDate = new Date(2026, 9, 13, 12);
const document = {
    name: 'Checkout flow',
    modified: new Date(2026, 9, 13, 8),
    tags: ['Prototype', 'Client project']
};
const filters: DocumentListFilters = { query: '', date: 'all', tags: [] };

describe('matchesDocument', () => {
    it('searches only the name, ignoring case and surrounding query whitespace', () => {
        expect(matchesDocument(document, { ...filters, query: '  FLOW  ' }, referenceDate)).toBe(
            true
        );
        expect(matchesDocument(document, { ...filters, query: 'Prototype' }, referenceDate)).toBe(
            false
        );
        expect(matchesDocument(document, { ...filters, query: '  ' }, referenceDate)).toBe(true);
    });

    it('matches any selected tag, and includes untagged documents when none are selected', () => {
        expect(
            matchesDocument(
                document,
                { ...filters, tags: ['UI kit', 'Client project'] },
                referenceDate
            )
        ).toBe(true);
        expect(matchesDocument(document, { ...filters, tags: ['UI kit'] }, referenceDate)).toBe(
            false
        );
        expect(matchesDocument({ ...document, tags: [] }, filters, referenceDate)).toBe(true);
    });

    it('matches the same tag across casing and surrounding whitespace in saved documents', () => {
        const selected = { ...filters, tags: [' CLIENT project '] };

        for (const tag of ['Client project', 'client PROJECT', ' Client project ']) {
            expect(matchesDocument({ ...document, tags: [tag] }, selected, referenceDate)).toBe(
                true
            );
        }
        expect(
            matchesDocument({ ...document, tags: ['Client projects'] }, selected, referenceDate)
        ).toBe(false);
    });

    it('requires the name, date and tag filters to match together', () => {
        const combined: DocumentListFilters = {
            query: 'checkout',
            date: 'today',
            tags: ['Prototype']
        };

        expect(matchesDocument(document, combined, referenceDate)).toBe(true);
        expect(matchesDocument({ ...document, name: 'Other' }, combined, referenceDate)).toBe(
            false
        );
        expect(matchesDocument({ ...document, tags: [] }, combined, referenceDate)).toBe(false);
        expect(
            matchesDocument(
                { ...document, modified: new Date(2026, 9, 12, 23, 59) },
                combined,
                referenceDate
            )
        ).toBe(false);
    });

    it.each([
        { date: 'today', start: new Date(2026, 9, 13) },
        { date: 'week', start: new Date(2026, 9, 7) },
        { date: 'month', start: new Date(2026, 8, 14) }
    ] as const)('uses inclusive local midnight for $date', ({ date, start }) => {
        const selected = { ...filters, date };

        expect(matchesDocument({ ...document, modified: start }, selected, referenceDate)).toBe(
            true
        );
        expect(
            matchesDocument(
                { ...document, modified: new Date(start.getTime() - 1) },
                selected,
                referenceDate
            )
        ).toBe(false);
        expect(
            matchesDocument(
                { ...document, modified: new Date(2026, 9, 13, 23, 59, 59, 999) },
                selected,
                referenceDate
            )
        ).toBe(true);
        expect(
            matchesDocument(
                { ...document, modified: new Date(2026, 9, 14) },
                selected,
                referenceDate
            )
        ).toBe(false);
    });

    it('crosses month and year boundaries without changing the reference date', () => {
        const january = new Date(2027, 0, 2, 10);
        const before = january.getTime();

        expect(
            matchesDocument(
                { ...document, modified: new Date(2026, 11, 27) },
                { ...filters, date: 'week' },
                january
            )
        ).toBe(true);
        expect(january.getTime()).toBe(before);
    });

    it.each([
        { reference: new Date(2026, 2, 30, 12), start: new Date(2026, 2, 24) },
        { reference: new Date(2026, 9, 26, 12), start: new Date(2026, 9, 20) }
    ])(
        'keeps midnight boundaries across daylight-saving changes: $reference',
        ({ reference, start }) => {
            const selected: DocumentListFilters = { ...filters, date: 'week' };

            expect(matchesDocument({ ...document, modified: start }, selected, reference)).toBe(
                true
            );
            expect(
                matchesDocument(
                    { ...document, modified: new Date(start.getTime() - 1) },
                    selected,
                    reference
                )
            ).toBe(false);
        }
    );

    it('includes old documents when the time filter is all', () => {
        expect(
            matchesDocument({ ...document, modified: new Date(2020, 0, 1) }, filters, referenceDate)
        ).toBe(true);
    });
});

describe('normalizeTags', () => {
    it('deduplicates trimmed names without changing the first spelling or input array', () => {
        const tags = [' UI kit ', 'ui KIT', '', '  ', 'Prototype', ' prototype '];
        const original = [...tags];

        expect(normalizeTags(tags)).toEqual(['UI kit', 'Prototype']);
        expect(tags).toEqual(original);
    });
});

describe('documentModifiedLabel', () => {
    it('labels local calendar days across midnight and year boundaries', () => {
        const january = new Date(2027, 0, 1, 0, 5);

        expect(documentModifiedLabel(new Date(2027, 0, 1), january)).toBe('Today');
        expect(documentModifiedLabel(new Date(2026, 11, 31, 23, 59), january)).toBe('Yesterday');
        expect(documentModifiedLabel(new Date(2026, 11, 30), january, 'en-US')).toBe(
            'Dec 30, 2026'
        );
    });

    it('formats older dates using the locale, adding the year only when needed', () => {
        const modified = new Date(2026, 9, 10);

        expect(documentModifiedLabel(modified, referenceDate, 'en-US')).toBe('Oct 10');
        expect(documentModifiedLabel(modified, referenceDate, 'en-GB')).toBe('10 Oct');
        expect(documentModifiedLabel(new Date(2025, 9, 10), referenceDate, 'en-US')).toBe(
            'Oct 10, 2025'
        );
    });
});

describe('documentTagTone', () => {
    it("keeps a tag's tone however other tags change", () => {
        const tone = documentTagTone('Client project');

        expect(documentTagTone(' client PROJECT ')).toBe(tone);
        expect(['Alpha', 'Zeta', 'UI kit'].map(() => documentTagTone('Client project'))).toEqual([
            tone,
            tone,
            tone
        ]);
    });

    it('spreads tags over the palette and uses only its colors', () => {
        const names = [
            'Client project',
            'UI kit',
            'Prototype',
            'Research',
            'Mobile',
            'Draft',
            'Archive',
            'Výzkum',
            '新しい企画',
            'x'.repeat(1000)
        ];
        const tones = names.map((name) => documentTagTone(name));

        expect(new Set(tones).size).toBeGreaterThan(3);
        for (const tone of tones) {
            expect(['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray']).toContain(tone);
        }
    });
});

describe('chosen tag tones', () => {
    it("uses a chosen tone over the name's", () => {
        const fromName = documentTagTone('Client project');
        const chosen = fromName === 'red' ? 'blue' : 'red';

        expect(documentTagTone(' client PROJECT ', { 'client project': chosen })).toBe(chosen);
    });

    it("takes each tag's tone from the latest edited document that chose one", () => {
        const older = {
            modified: new Date(2026, 9, 1),
            tags: ['UI kit', 'Draft'],
            tagTones: { 'ui kit': 'green', draft: 'gray' } as const
        };
        const newer = {
            modified: new Date(2026, 9, 2),
            tags: ['UI kit'],
            tagTones: { 'ui kit': 'purple', draft: 'red' } as const
        };

        // A tone kept for a tag the document no longer has does not count.
        expect(chosenTagTones([newer, older])).toEqual({ 'ui kit': 'purple', draft: 'gray' });
    });
});
