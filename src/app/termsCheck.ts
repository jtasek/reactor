const listeners = new Set<() => void>();
let settled: string | null = null;

/**
 * The account whose terms check is done: it has agreed to the current terms, or the
 * check could not run. Other questions for that account, such as moving signed-out
 * documents, wait for it so they never open underneath the terms dialog.
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
