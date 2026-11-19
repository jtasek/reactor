/** How loosely the local model reads words, kept in one place to tune. */
export const MATCHING = {
    /** Likeness, of 1, from which a mistyped word counts as the term it resembles. */
    similar: 0.74,
    /** Likeness from which a word that was not understood is offered as "did you mean". */
    suggest: 0.6,
    /** Words shorter than this only match exactly: "red" is not "rad". */
    shortWord: 4,
    /** The likeness of a word that begins a term, as "rect" begins "rectangle". */
    abbreviation: 0.9,
    /** The likeness of a plural to its term. */
    plural: 0.97,
    /** How many "did you mean" terms an answer offers. */
    suggestions: 3
};

/** Edits between two words, counting two swapped neighbours as one (optimal string alignment). */
export function distance(a: string, b: string): number {
    const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length)]);

    for (let j = 1; j <= b.length; j++) {
        rows[0][j] = j;
    }
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;

            rows[i][j] = Math.min(
                rows[i - 1][j] + 1,
                rows[i][j - 1] + 1,
                rows[i - 1][j - 1] + cost
            );
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
            }
        }
    }

    return rows[a.length][b.length];
}

const swapped = (a: string, b: string) =>
    a.length === b.length && [...a].sort().join('') === [...b].sort().join('');

/**
 * How alike a typed word and a term are, from 0 to 1. Typos rarely hit the first
 * letter, so words that start differently are unlike ("light" is not "right"), and
 * short words allow only swapped letters ("more" is not "move", "bleu" is "blue").
 */
export function similarity(word: string, term: string): number {
    if (word === term) {
        return 1;
    }
    if (word.length < MATCHING.shortWord || term.length < MATCHING.shortWord) {
        return 0;
    }
    if (word === `${term}s` || word === `${term}es`) {
        return MATCHING.plural;
    }
    // A mistyped plural: "circels" is "circel", which is "circle".
    if (word.endsWith('s') && word.length > MATCHING.shortWord && !term.endsWith('s')) {
        return MATCHING.plural * similarity(word.slice(0, -1), term);
    }
    if (word[0] !== term[0]) {
        return 0;
    }
    if (term.startsWith(word)) {
        return MATCHING.abbreviation;
    }

    const edits = distance(word, term);
    const longest = Math.max(word.length, term.length);

    if (longest <= MATCHING.shortWord && !(edits === 1 && swapped(word, term))) {
        return 0;
    }

    return 1 - edits / longest;
}

/** A term of a vocabulary: what it stands for and the phrases that say it. */
export interface Term<Id extends string = string> {
    id: Id;
    phrases: string[];
}

export interface Match<Id extends string = string> {
    id: Id;
    /** The first word it covers, and how many. */
    at: number;
    length: number;
    score: number;
}

/**
 * The terms `words` mention, best first: longer phrases win over the words inside
 * them ("font size" over "size"), and no word counts for two terms of one vocabulary
 * unless they share the phrase, as "color" is both a fill and a font color.
 */
export function mentions<Id extends string>(
    words: readonly (string | undefined)[],
    vocabulary: readonly Term<Id>[],
    least = MATCHING.similar
): Match<Id>[] {
    const found: Match<Id>[] = [];

    vocabulary.forEach(({ id, phrases }) =>
        phrases.forEach((phrase) => {
            const parts = phrase.split(' ');

            for (let at = 0; at + parts.length <= words.length; at++) {
                const scores = parts.map((part, index) => {
                    const word = words[at + index];

                    return word === undefined ? 0 : similarity(word, part);
                });
                const score = Math.min(...scores);

                if (score >= least) {
                    found.push({ id, at, length: parts.length, score });
                }
            }
        })
    );
    found.sort((a, b) => b.length - a.length || b.score - a.score || a.at - b.at);

    const kept: Match<Id>[] = [];

    found.forEach((match) => {
        const overlaps = kept.some(
            (other) =>
                match.at < other.at + other.length &&
                other.at < match.at + match.length &&
                // Terms sharing the very same words stay together, the better one first.
                !(
                    other.at === match.at &&
                    other.length === match.length &&
                    other.score === match.score
                )
        );

        if (!overlaps && !kept.some((other) => other.id === match.id && other.at === match.at)) {
            kept.push(match);
        }
    });

    return kept.sort((a, b) => a.at - b.at || b.score - a.score);
}

/** The phrases of `vocabulary` most like `word`, for "did you mean", best first. */
export function suggestions(word: string, vocabulary: readonly Term[]): string[] {
    const scored = vocabulary.flatMap(({ phrases }) =>
        phrases.map((phrase) => {
            const likeness = Math.max(
                ...phrase.split(' ').map((part) => {
                    const longest = Math.max(word.length, part.length);

                    return word[0] === part[0] ? 1 - distance(word, part) / longest : 0;
                })
            );

            return { phrase, likeness };
        })
    );

    return [
        ...new Set(
            scored
                .filter(({ likeness }) => likeness >= MATCHING.suggest)
                .sort((a, b) => b.likeness - a.likeness)
                .map(({ phrase }) => phrase)
        )
    ].slice(0, MATCHING.suggestions);
}
