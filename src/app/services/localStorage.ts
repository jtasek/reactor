export const loadState = (key: string): unknown => {
    try {
        const serializedState = localStorage.getItem(key);

        if (!serializedState) {
            return null;
        }

        return JSON.parse(serializedState);
    } catch (error) {
        console.warn(`Failed to load application state for "${key}"; ignoring it.`, error);
        return null;
    }
};

export const saveState = (key: string, state: unknown): void => {
    try {
        const serializedState = JSON.stringify(state);

        localStorage.setItem(key, serializedState);

        console.log('Application state saved');
    } catch (error) {
        console.error('Failed to save application state', error);
    }
};
