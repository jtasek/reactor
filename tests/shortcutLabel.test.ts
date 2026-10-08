import { shortcutLabel } from 'src/ui/components/CommandBar/shortcutLabel';

describe('a shortcut as shown', () => {
    it('names the keys of its first binding, joined with + off a Mac', () => {
        expect(shortcutLabel('mod+d', false)).toBe('Ctrl+D');
        expect(shortcutLabel('mod+alt+shift+l', false)).toBe('Ctrl+Alt+Shift+L');
        expect(shortcutLabel('delete,backspace', false)).toBe('Delete');
        expect(shortcutLabel('+,=', false)).toBe('+');
        expect(shortcutLabel(']', false)).toBe(']');
        expect(shortcutLabel('arrowleft', false)).toBe('←');
    });

    it('uses the Mac’s symbols, without +, on a Mac', () => {
        expect(shortcutLabel('mod+d', true)).toBe('⌘D');
        expect(shortcutLabel('mod+alt+shift+l', true)).toBe('⌘⌥⇧L');
        expect(shortcutLabel('r', true)).toBe('R');
    });
});
