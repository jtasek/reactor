import { parseBinding } from 'src/events/shortcuts';

const MODIFIER_LABELS: Record<string, { mac: string; other: string }> = {
    mod: { mac: '⌘', other: 'Ctrl' },
    alt: { mac: '⌥', other: 'Alt' },
    shift: { mac: '⇧', other: 'Shift' }
};

/** The order modifiers are shown in: Option, Shift, Command on a Mac; Ctrl, Alt, Shift elsewhere. */
const MODIFIER_ORDER = { mac: ['alt', 'shift', 'mod'], other: ['mod', 'alt', 'shift'] };

const KEY_LABELS: Record<string, string> = {
    arrowleft: '←',
    arrowright: '→',
    arrowup: '↑',
    arrowdown: '↓'
};

/** Whether this device shows shortcuts with the Command key's symbols, as Apple's do. */
export const usesCommandKey = (userAgent = navigator.userAgent) =>
    /Mac|iPhone|iPad/.test(userAgent);

const capitalized = (key: string) => key.charAt(0).toUpperCase() + key.slice(1);

/**
 * How `shortcut` is shown: its first binding's keys, as `Ctrl+Shift+G`, or with the
 * Mac's symbols, as `⇧⌘G`.
 */
export function shortcutLabel(shortcut: string, mac: boolean): string {
    const { key, modifiers } = parseBinding(shortcut.split(',')[0]);
    const platform = mac ? 'mac' : 'other';
    const labels = [
        ...MODIFIER_ORDER[platform]
            .filter((modifier) => modifiers.includes(modifier))
            .map((modifier) => MODIFIER_LABELS[modifier][platform]),
        KEY_LABELS[key] ?? capitalized(key)
    ];

    return labels.join(mac ? '' : '+');
}

const MODIFIER_KEYS: Record<string, { mac: string; other: string }> = {
    mod: { mac: 'Meta', other: 'Control' },
    alt: { mac: 'Alt', other: 'Alt' },
    shift: { mac: 'Shift', other: 'Shift' }
};

/** `shortcut`'s bindings as `aria-keyshortcuts` names them, as `Control+Shift+G`. */
export const shortcutKeys = (shortcut: string, mac: boolean): string =>
    shortcut
        .split(',')
        .map((binding) => {
            const { key, modifiers } = parseBinding(binding);

            return [
                ...MODIFIER_ORDER.other
                    .filter((modifier) => modifiers.includes(modifier))
                    .map((modifier) => MODIFIER_KEYS[modifier][mac ? 'mac' : 'other']),
                capitalized(key)
            ].join('+');
        })
        .join(' ');
