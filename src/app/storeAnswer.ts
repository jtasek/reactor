import { useMemo, useRef, useSyncExternalStore } from 'react';
import type { IProxyStateTree } from 'proxy-state-tree';
import type { Context } from './index';
import { useReaction } from './hooks';
import { storeOf } from './storeOf';
import { readingDerivedOnce } from './derivedMemo';

type Store = IProxyStateTree<object, unknown>;
type State = Context['state'];
type Write = { hasChangedValue: boolean };

/**
 * `read` over the store, and how to hear when it may answer differently.
 *
 * `useAppState` subscribes a component to each path it read, one by one, on
 * every render. A placed Screen view is read through tens of thousands of paths,
 * so that cost a selection change hundreds of milliseconds. Here the paths are
 * only kept in a set, and each write is checked against it.
 */
export function storeAnswer<T>(store: Store, read: (state: State) => T) {
    const flushes = store as unknown as { currentFlushId: number };
    let paths = new Set<string>();
    let readAt = flushes.currentFlushId;

    return {
        read(): T {
            const tree = store.getTrackStateTree();
            let value!: T;

            tree.trackScope(() => {
                value = readingDerivedOnce(store, tree, () => read(tree.state as State));
            });
            paths = tree.pathDependencies as Set<string>;
            readAt = flushes.currentFlushId;

            return value;
        },
        /**
         * Calls `changed` once a flush has changed something the last answer read,
         * and at once when the store flushed since that answer.
         */
        subscribe(changed: () => void) {
            let touched = false;
            // proxy-state-tree's types leave out that these return how to stop.
            // A write comes with its path, and its table's when it adds or
            // removes a key. A write of the value already there changes nothing.
            const stopWrites = store.onMutation((write: Write, written: Set<string>) => {
                if (
                    !touched &&
                    (write.hasChangedValue || written.size > 1) &&
                    [...written].some((path) => paths.has(path))
                ) {
                    touched = true;
                }
            }) as unknown as () => void;
            const stopFlushes = store.onFlush(() => {
                if (touched) {
                    touched = false;
                    changed();
                }
            }) as unknown as () => void;

            // A flush between the answer and this subscription went unheard.
            if (flushes.currentFlushId !== readAt) {
                changed();
            }

            return () => {
                stopWrites();
                stopFlushes();
            };
        }
    };
}

const stores = new WeakMap<Context['reaction'], Store>();

/**
 * `read` over the store, as `useAppState` gives it, but answered again only
 * after a flush changed something it read: see `storeAnswer`. The answer is
 * worked out as the component renders, after the action, not inside it. `deps`
 * names what `read` uses besides the store.
 */
export function useStoreAnswer<T>(read: (state: State) => T, deps: readonly unknown[]): T {
    const reaction = useReaction();

    if (!stores.has(reaction)) {
        stores.set(reaction, storeOf(reaction));
    }
    const store = stores.get(reaction)!;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const answer = useMemo(() => storeAnswer(store, read), [store, ...deps]);
    const version = useRef(0);
    const subscribe = useMemo(
        () => (changed: () => void) =>
            answer.subscribe(() => {
                version.current++;
                changed();
            }),
        [answer]
    );
    const seen = useSyncExternalStore(subscribe, () => version.current);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    return useMemo(() => answer.read(), [answer, seen]);
}
