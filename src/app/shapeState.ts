import { useLayoutEffect, useReducer } from 'react';
import type { IProxyStateTree, ITrackStateTree } from 'proxy-state-tree';
import type { Context } from '.';
import { useReaction } from './hooks';
import { storeOf } from './storeOf';
import { untracked } from './untracked';

type State = Context['state'];
type Store = IProxyStateTree<object, unknown>;
type Tree = ITrackStateTree<object, unknown>;

/** A document's shape table or shape list: what adding or removing any shape changes. */
const SHAPE_SET = /^documents\.[^.]+\.(shapes|shapesIds)$/;
/** One shape of a document's table, which reading it by id tracks. */
const SHAPE_ENTRY = /^documents\.[^.]+\.shapes\.[^.]+$/;

/** What one render read: the derived values it used and the paths it read itself. */
interface Reads {
    /** How deep in derived values the render is reading: 0 is the render itself. */
    depth: number;
    derived: { path: string; value: unknown }[];
    direct: Set<string>;
    /** Shape tables the render read every entry of, as of when it was drawn. */
    wholeTables: Set<string>;
}

const reading = new WeakMap<object, Reads>();
const watched = new WeakSet<Store>();
/** Stores whose derived reads can be seen. Without that, nothing is skipped. */
const seeing = new WeakSet<Store>();

/**
 * Has Overmind's derived values say which ones a tracked render reads, and what
 * they were. Overmind evaluates a derived value through this option of the store.
 */
function watchDerivedReads(store: Store) {
    if (watched.has(store)) {
        return;
    }
    watched.add(store);

    const options = (store as unknown as { options: { onGetFunction?: GetFunction } }).options;
    const evaluate = options.onGetFunction;

    if (typeof evaluate !== 'function') {
        return;
    }
    seeing.add(store);
    options.onGetFunction = (tree, path, target, prop) => {
        const reads = reading.get(tree);

        if (!reads) {
            return evaluate(tree, path, target, prop);
        }
        reads.depth++;
        try {
            const value = evaluate(tree, path, target, prop);

            if (reads.depth === 1 && value !== target[prop]) {
                reads.derived.push({ path, value });
            }

            return value;
        } finally {
            reads.depth--;
        }
    };
}

type GetFunction = (
    tree: object,
    path: string,
    target: Record<string, unknown>,
    prop: string
) => unknown;

/**
 * The value at `path`, read for no component: while a component's render is
 * tracked, until its subscription starts, the store adds every read to it.
 */
function at(store: Store, path: string) {
    const root = store as unknown as { currentTree: unknown };
    const current = root.currentTree;

    root.currentTree = null;
    try {
        return path
            .split('.')
            .reduce<unknown>(
                (parent, key) => (parent as Record<string, unknown> | undefined)?.[key],
                store.state
            );
    } finally {
        root.currentTree = current;
    }
}

/**
 * Whether a change that only added or removed shapes leaves what `reads` read as
 * it was. Reading one shape by id tracks the whole shape table, so without this
 * every shape on the canvas renders again when any shape is added or removed.
 *
 * A change to a shape it read by id comes as a change to that shape's own path,
 * so the table itself can be left out, unless the render went through the whole
 * table or read the shape list. A derived value that reads either is asked again:
 * if it answers the same, nothing this render used has changed.
 */
function onlyOtherShapesChanged(reads: Reads, hits: string[], now: (path: string) => unknown) {
    const unaffected = hits.every(
        (path) =>
            SHAPE_SET.test(path) &&
            (!reads.direct.has(path) || (path.endsWith('.shapes') && !reads.wholeTables.has(path)))
    );

    return unaffected && reads.derived.every(({ path, value }) => sameValue(now(path), value));
}

const compared = new WeakMap<object, WeakMap<object, boolean>>();

/**
 * Whether two answers of a derived value are the same. Overmind works a derived
 * value out again when an action reads it, so an unchanged answer can be a new
 * list or object. Shapes ask the same derived values, so each pair is compared once.
 */
function sameValue(next: unknown, previous: unknown): boolean {
    if (Object.is(next, previous)) {
        return true;
    }
    if (
        typeof next !== 'object' ||
        typeof previous !== 'object' ||
        next === null ||
        previous === null ||
        untracked(next) !== next ||
        untracked(previous) !== previous
    ) {
        return false;
    }
    const known = compared.get(previous)?.get(next);

    if (known !== undefined) {
        return known;
    }
    const same = sameContent(next, previous);

    if (!compared.has(previous)) {
        compared.set(previous, new WeakMap());
    }
    compared.get(previous)!.set(next, same);

    return same;
}

function sameContent(next: object, previous: object) {
    if (Array.isArray(next) || Array.isArray(previous)) {
        return (
            Array.isArray(next) &&
            Array.isArray(previous) &&
            next.length === previous.length &&
            next.every((item, index) => sameValue(item, previous[index]))
        );
    }
    if (next instanceof Set || previous instanceof Set) {
        return (
            next instanceof Set &&
            previous instanceof Set &&
            next.size === previous.size &&
            [...next].every((item) => previous.has(item))
        );
    }
    if (
        Object.getPrototypeOf(next) !== Object.prototype ||
        Object.getPrototypeOf(previous) !== Object.prototype
    ) {
        return false;
    }
    const keys = Object.keys(next);

    return (
        keys.length === Object.keys(previous).length &&
        keys.every(
            (key) =>
                Object.hasOwn(previous, key) &&
                sameValue(
                    (next as Record<string, unknown>)[key],
                    (previous as Record<string, unknown>)[key]
                )
        )
    );
}

/** The shape tables a render read every entry of, as a list of shapes does. */
function wholeTables(store: Store, direct: Set<string>) {
    const entries = new Map<string, number>();

    for (const path of direct) {
        if (SHAPE_ENTRY.test(path)) {
            const table = path.slice(0, path.lastIndexOf('.'));
            entries.set(table, (entries.get(table) ?? 0) + 1);
        }
    }

    // The shape list has an id for each shape in the table.
    return new Set(
        [...entries]
            .filter(([table, count]) => count >= shapeCount(store, `${table}Ids`))
            .map(([table]) => table)
    );
}

const shapeCount = (store: Store, path: string) =>
    (untracked(at(store, path) as object) as string[] | undefined)?.length ?? 0;

/**
 * Tracks what a render reads from `store` from now until `subscribe`, as
 * overmind-react's state hook does, and calls `onChange` when it changes; but
 * not when shapes other than the ones it read are added or removed, unless a
 * derived value it read answers differently because of it.
 */
export function trackShapeReads(store: Store) {
    watchDerivedReads(store);

    const tree = store.getTrackStateTree() as Tree;
    const reads: Reads = { depth: 0, derived: [], direct: new Set(), wholeTables: new Set() };

    reading.set(tree, reads);
    tree.trackPathListeners.push((path) => {
        if (reads.depth === 0) {
            reads.direct.add(path);
        }
    });
    tree.track();

    return {
        state: tree.state as State,
        /** Stops tracking and calls `onChange` on each change to what was read. */
        subscribe(onChange: () => void) {
            reading.delete(tree);

            const stop = tree.subscribe((_, paths) => {
                const { changed, values } = flushOf(paths);
                const hits = [...tree.pathDependencies].filter((path) => changed.has(path));
                const now = (path: string) => {
                    if (!values.has(path)) {
                        values.set(path, at(store, path));
                    }

                    return values.get(path);
                };

                if (!seeing.has(store) || !onlyOtherShapesChanged(reads, hits, now)) {
                    onChange();
                }
            });

            // Read once tracking has stopped, so this reading is not tracked.
            reads.wholeTables = wholeTables(store, reads.direct);

            return stop;
        }
    };
}

const flushes = new WeakMap<string[], { changed: Set<string>; values: Map<string, unknown> }>();

/**
 * A flush's changed paths, and the derived values asked after it, shared by
 * every subscriber the flush calls.
 */
function flushOf(paths: string[]) {
    if (!flushes.has(paths)) {
        flushes.set(paths, { changed: new Set(paths), values: new Map() });
    }

    return flushes.get(paths)!;
}

const stores = new WeakMap<Context['reaction'], Store>();

/**
 * The state for a component that draws one shape: `useAppState((state) => state)`,
 * except that it does not render again when other shapes are added or removed.
 */
export function useShapeState(): State {
    const reaction = useReaction();
    const [, rerender] = useReducer((count: number) => count + 1, 0);

    if (!stores.has(reaction)) {
        stores.set(reaction, storeOf(reaction));
    }
    // A new tracker on each render, as overmind-react starts a new tree.
    const tracked = trackShapeReads(stores.get(reaction)!);

    useLayoutEffect(() => tracked.subscribe(rerender), [tracked]);

    return tracked.state;
}
