import type { IProxyStateTree } from 'proxy-state-tree';

type Store = IProxyStateTree<object, unknown>;
type GetFunction = (
    tree: object,
    path: string,
    target: Record<string, unknown>,
    prop: string
) => unknown;

/** The derived values read so far, per tree that is answering once. */
const memos = new WeakMap<object, { depth: number; values: Map<string, unknown> }>();
const wrapped = new WeakSet<Store>();

/**
 * Has the store's derived values answer from `memos` when a tree asks again.
 * Overmind evaluates a derived value through this option of the store.
 */
function memoizeDerivedReads(store: Store) {
    if (wrapped.has(store)) {
        return;
    }
    wrapped.add(store);

    const options = (store as unknown as { options: { onGetFunction?: GetFunction } }).options;
    const evaluate = options.onGetFunction;

    if (typeof evaluate !== 'function') {
        return;
    }
    options.onGetFunction = (tree, path, target, prop) => {
        const memo = memos.get(tree);

        if (!memo) {
            return evaluate(tree, path, target, prop);
        }
        // A derived value read while another one is worked out must add its
        // paths to that one, so only reads of the caller's own are answered here.
        if (memo.depth === 0 && memo.values.has(path)) {
            return memo.values.get(path);
        }
        memo.depth++;
        try {
            const value = evaluate(tree, path, target, prop);

            if (memo.depth === 1) {
                memo.values.set(path, value);
            }

            return value;
        } finally {
            memo.depth--;
        }
    };
}

/**
 * Runs `read`, which reads `tree` while it tracks and changes nothing, reading
 * each derived value through the store once. Overmind adds every path a derived
 * value depends on to the tracking tree on each read, so many guards asking the
 * same derived value of thousands of shapes went through those paths again each.
 * The tree has the paths from the first read, so later ones only take its value.
 */
export function readingDerivedOnce<T>(store: Store, tree: object, read: () => T): T {
    memoizeDerivedReads(store);
    memos.set(tree, { depth: 0, values: new Map() });
    try {
        return read();
    } finally {
        memos.delete(tree);
    }
}
