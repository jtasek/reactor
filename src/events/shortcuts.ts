/** The parts of a key press that shortcuts are matched against. */
export type KeyPress = Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>;

function parseBinding(binding: string) {
    const lower = binding.trim().toLowerCase();
    // The key itself may be `+`, as in `+` or `mod++`.
    const keyStart = lower.endsWith('+') ? lower.length - 1 : lower.lastIndexOf('+') + 1;

    return {
        key: lower.slice(keyStart),
        modifiers: lower
            .slice(0, Math.max(0, keyStart - 1))
            .split('+')
            .filter(Boolean)
    };
}

function matchesBinding(binding: string, press: KeyPress): boolean {
    const { key, modifiers } = parseBinding(binding);

    if (press.key.toLowerCase() !== key) {
        return false;
    }

    if (modifiers.includes('mod') !== (press.ctrlKey || press.metaKey)) {
        return false;
    }

    if (modifiers.includes('alt') !== press.altKey) {
        return false;
    }

    // A symbol's character already reflects Shift (`+` is Shift+= on many
    // layouts), so Shift only has to match for letters and named keys.
    const isSymbol = key.length === 1 && !/[a-z]/.test(key);

    return isSymbol || modifiers.includes('shift') === press.shiftKey;
}

/**
 * Whether `press` matches `shortcut`: comma-separated alternatives, each a
 * `+`-joined list of modifiers (`mod` for Ctrl or Cmd, `shift`, `alt`) ending in
 * a key compared with `KeyboardEvent.key`, ignoring case — e.g. `r`, `mod+d`,
 * `mod+shift+g`, `delete,backspace` or `+,=`. Modifiers must match exactly, so
 * `r` does not fire on Ctrl+R.
 */
export function matchesShortcut(shortcut: string, press: KeyPress): boolean {
    return shortcut.split(',').some((binding) => matchesBinding(binding, press));
}
