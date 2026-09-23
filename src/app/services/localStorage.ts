/** Only a missing key returns undefined; read failures propagate to the UI. */
export const loadState = (key: string): unknown => {
    const value = localStorage.getItem(key);

    return value === null ? undefined : JSON.parse(value);
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

    const backupPrefix = `${key}:backup:`;

    // Autosave is optional, so the same legacy payload can be loaded repeatedly.
    for (let index = 0; index < localStorage.length; index++) {
        const existingKey = localStorage.key(index);

        if (existingKey?.startsWith(backupPrefix) && localStorage.getItem(existingKey) === value) {
            return;
        }
    }

    const prefix = `${backupPrefix}${Date.now()}`;
    let backupKey = prefix;
    let suffix = 0;

    while (localStorage.getItem(backupKey) !== null) {
        backupKey = `${prefix}:${++suffix}`;
    }

    localStorage.setItem(backupKey, value);
};
