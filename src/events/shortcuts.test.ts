import { KeyPress, matchesShortcut } from './shortcuts';

const press = (key: string, modifiers: Partial<Omit<KeyPress, 'key'>> = {}): KeyPress => ({
    key,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...modifiers
});

describe('matchesShortcut()', () => {
    it('matches a plain key ignoring case, but not with extra modifiers', () => {
        expect(matchesShortcut('r', press('r'))).toBe(true);
        expect(matchesShortcut('r', press('R'))).toBe(true);
        expect(matchesShortcut('r', press('r', { ctrlKey: true }))).toBe(false);
        expect(matchesShortcut('r', press('r', { metaKey: true }))).toBe(false);
        expect(matchesShortcut('r', press('R', { shiftKey: true }))).toBe(false);
        expect(matchesShortcut('r', press('r', { altKey: true }))).toBe(false);
    });

    it('treats mod as Ctrl or Cmd', () => {
        expect(matchesShortcut('mod+d', press('d', { ctrlKey: true }))).toBe(true);
        expect(matchesShortcut('mod+d', press('d', { metaKey: true }))).toBe(true);
        expect(matchesShortcut('mod+d', press('d'))).toBe(false);
    });

    it('requires Shift exactly for letters', () => {
        expect(matchesShortcut('mod+shift+g', press('G', { ctrlKey: true, shiftKey: true }))).toBe(
            true
        );
        expect(matchesShortcut('mod+shift+g', press('g', { ctrlKey: true }))).toBe(false);
        expect(matchesShortcut('mod+g', press('G', { ctrlKey: true, shiftKey: true }))).toBe(false);
    });

    it('ignores Shift for symbols, whose character already reflects it', () => {
        expect(matchesShortcut('+,=', press('+', { shiftKey: true }))).toBe(true);
        expect(matchesShortcut('+,=', press('='))).toBe(true);
        expect(matchesShortcut('-', press('-'))).toBe(true);
        expect(matchesShortcut('0', press('0'))).toBe(true);
        expect(matchesShortcut('mod++', press('+', { metaKey: true, shiftKey: true }))).toBe(true);
    });

    it('matches named keys and any listed alternative', () => {
        expect(matchesShortcut('delete,backspace', press('Delete'))).toBe(true);
        expect(matchesShortcut('delete,backspace', press('Backspace'))).toBe(true);
        expect(matchesShortcut('delete,backspace', press('d'))).toBe(false);
    });
});
