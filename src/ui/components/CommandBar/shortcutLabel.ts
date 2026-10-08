import { parseBinding } from 'src/events/shortcuts';

const MODIFIER_LABELS: Record<string, { mac: string; other: string }> = {
    mod: { mac: '⌘', other: 'Ctrl' },
    alt: { mac: '⌥', other: 'Alt' },
    shift: { mac: '⇧', other: 'Shift' }
};

const KEY_LABELS: Record<string, string> = {
    arrowleft: '←',
    arrowright: '→',
    arrowup: '↑',
    arrowdown: '↓'
};

/** Whether this device shows shortcuts with the Command key's symbols, as Apple's do. */
export const usesCommandKey = (userAgent = navigator.userAgent) =>
    /Mac|iPhone|iPad/.test(userAgent);

/**
 * How `shortcut` is shown: its first binding's keys, as `Ctrl+Shift+G`, or with the
 * Mac's symbols, as `⌘⇧G`.
 */
export function shortcutLabel(shortcut: string, mac: boolean): string {
    const { key, modifiers } = parseBinding(shortcut.split(',')[0]);
    const keyLabel = KEY_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
    const labels = [
        ...modifiers.map(
            (modifier) => MODIFIER_LABELS[modifier]?.[mac ? 'mac' : 'other'] ?? modifier
        ),
        keyLabel
    ];

    return labels.join(mac ? '' : '+');
}
