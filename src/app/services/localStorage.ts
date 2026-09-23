/** Failures propagate to startup/autosave so the UI can report them. */
export const loadState = (key: string): unknown => {
    const value = localStorage.getItem(key);

    return value === null ? null : JSON.parse(value);
};

export const saveState = (key: string, state: unknown): void => {
    localStorage.setItem(key, JSON.stringify(state));
};

/** Keep the exact original bytes, including malformed JSON, before migration. */
export const backupState = (key: string): void => {
    const value = localStorage.getItem(key);

    if (value === null) {
        return;
    }

    const prefix = `${key}:backup:${Date.now()}`;
    let backupKey = prefix;
    let suffix = 0;
    while (localStorage.getItem(backupKey) !== null) {
        backupKey = `${prefix}:${++suffix}`;
    }

    localStorage.setItem(backupKey, value);
};
