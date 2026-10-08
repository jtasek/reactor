import { shortcutKeys, shortcutLabel } from 'src/ui/components/CommandBar/shortcutLabel';

describe('a shortcut as shown', () => {
    it('names the keys of its first binding, joined with + off a Mac', () => {
        expect(shortcutLabel('mod+d', false)).toBe('Ctrl+D');
        expect(shortcutLabel('mod+alt+shift+l', false)).toBe('Ctrl+Alt+Shift+L');
        expect(shortcutLabel('alt+shift+h', false)).toBe('Alt+Shift+H');
        expect(shortcutLabel('delete,backspace', false)).toBe('Delete');
        expect(shortcutLabel('+,=', false)).toBe('+');
        expect(shortcutLabel(']', false)).toBe(']');
        expect(shortcutLabel('arrowleft', false)).toBe('←');
    });

    it('uses the Mac’s symbols, without +, on a Mac', () => {
        expect(shortcutLabel('mod+d', true)).toBe('⌘D');
        expect(shortcutLabel('mod+alt+shift+l', true)).toBe('⌥⇧⌘L');
        expect(shortcutLabel('mod+shift+g', true)).toBe('⇧⌘G');
        expect(shortcutLabel('r', true)).toBe('R');
    });

    it('names its bindings for assistive technology, as aria-keyshortcuts takes them', () => {
        expect(shortcutKeys('mod+d', false)).toBe('Control+D');
        expect(shortcutKeys('mod+d', true)).toBe('Meta+D');
        expect(shortcutKeys('mod+shift+g', false)).toBe('Control+Shift+G');
        expect(shortcutKeys('delete,backspace', false)).toBe('Delete Backspace');
    });
});
