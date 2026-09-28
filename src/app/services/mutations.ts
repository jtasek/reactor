import type { Context } from '../index';

type Listener = Parameters<Context['addMutationListener']>[0];

/**
 * One store mutation listener, registered first, that passes each mutation on to
 * the listeners added through the returned function. Overmind drops a derived
 * value's listener while it calls listeners, which skips the listener right after
 * it; a listener registered before any other is never the one skipped, and a Set
 * keeps calling the rest when one is removed.
 */
export function listenToMutations(instance: Pick<Context, 'addMutationListener'>) {
    const listeners = new Set<Listener>();

    instance.addMutationListener((mutation, paths, flushId) =>
        listeners.forEach((listener) => listener(mutation, paths, flushId))
    );

    return (listener: Listener) => {
        listeners.add(listener);

        return () => {
            listeners.delete(listener);
        };
    };
}
