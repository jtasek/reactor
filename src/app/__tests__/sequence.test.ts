import { Sequence } from '../sequence';

describe('Sequence', () => {
    it('returns incremental numbers starting at 1 by default', () => {
        const sequence = new Sequence();

        expect([sequence.next(), sequence.next(), sequence.next()]).toEqual([1, 2, 3]);
    });

    it('honours a custom start value', () => {
        const sequence = new Sequence([], 10);

        expect([sequence.next(), sequence.next()]).toEqual([10, 11]);
    });

    it('hands out preseeded available values before incrementing', () => {
        const sequence = new Sequence([5], 1);

        expect([sequence.next(), sequence.next()]).toEqual([5, 1]);
    });

    it('reuses a released value on the next call', () => {
        const sequence = new Sequence();
        sequence.next();
        sequence.next();
        sequence.reuse(1);

        expect(sequence.next()).toBe(1);
    });

    it('throws when reusing a value not yet handed out', () => {
        const sequence = new Sequence();
        sequence.next();

        expect(() => sequence.reuse(5)).toThrow();
    });
});
