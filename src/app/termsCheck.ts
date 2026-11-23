const listeners = new Set<() => void>();
let settled: string | null = null;
let asked = 0;

/**
 * The account whose terms check is done: it agreed to the current terms, or the check
 * could not run. The offer to move signed-out documents waits for it, so it never
 * covers the terms dialog.
 */
export const termsSettled = () => settled;

export const settleTerms = (owner: string) => {
    settled = owner;
    listeners.forEach((listener) => listener());
};

export const subscribeToTerms = (listener: () => void) => {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
};

/** How often the server said the account must agree first; each time the check runs again. */
export const termsAsked = () => asked;

export const askForTerms = () => {
    asked++;
    listeners.forEach((listener) => listener());
};
