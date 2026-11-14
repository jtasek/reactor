import { isDeepStrictEqual } from 'node:util';
import * as Y from 'yjs';

/** Kept as the live document has it: a restore never hides which editors wrote to it. */
const KEPT_ROOTS = new Set(['versions']);

type Kind = 'map' | 'array' | 'text';

/**
 * What a top-level shared type holds. A document read from an update knows its roots
 * only by name until they are asked for as a type, so this looks at their content.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rootKind(type: Y.AbstractType<any>): Kind | undefined {
    if (type instanceof Y.Map) return 'map';
    if (type instanceof Y.Text) return 'text';
    if (type instanceof Y.Array) return 'array';
    if (type._map.size > 0) return 'map';

    for (let item = type._start; item; item = item.right) {
        if (item.deleted) continue;
        if (item.content instanceof Y.ContentString || item.content instanceof Y.ContentFormat) {
            return 'text';
        }
        return 'array';
    }

    return undefined;
}

const root = (doc: Y.Doc, name: string, kind: Kind) =>
    kind === 'map' ? doc.getMap(name) : kind === 'text' ? doc.getText(name) : doc.getArray(name);

/** A copy of a snapshot's value that the live document can hold. */
function copy(value: unknown): unknown {
    if (value instanceof Y.Map) {
        const map = new Y.Map<unknown>();
        value.forEach((entry, key) => map.set(key, copy(entry)));
        return map;
    }
    if (value instanceof Y.Array) {
        return Y.Array.from(value.toArray().map(copy) as Parameters<typeof Y.Array.from>[0]);
    }
    if (value instanceof Y.Text) {
        return new Y.Text(value.toString());
    }
    return value;
}

function restoreText(live: Y.Text, snapshot: Y.Text) {
    if (isDeepStrictEqual(live.toDelta(), snapshot.toDelta())) return;
    live.delete(0, live.length);
    live.applyDelta(snapshot.toDelta());
}

function restoreArray(live: Y.Array<unknown>, snapshot: Y.Array<unknown>) {
    if (isDeepStrictEqual(live.toJSON(), snapshot.toJSON())) return;
    live.delete(0, live.length);
    live.insert(0, snapshot.toArray().map(copy));
}

/** Changes only the entries that differ, so others' edits elsewhere merge untouched. */
function restoreMap(live: Y.Map<unknown>, snapshot: Y.Map<unknown>) {
    for (const key of [...live.keys()]) {
        if (!snapshot.has(key)) live.delete(key);
    }
    snapshot.forEach((value, key) => {
        const current = live.get(key);

        if (value instanceof Y.Map && current instanceof Y.Map) {
            restoreMap(current, value);
        } else if (value instanceof Y.Array && current instanceof Y.Array) {
            restoreArray(current, value);
        } else if (value instanceof Y.Text && current instanceof Y.Text) {
            restoreText(current, value);
        } else if (
            !live.has(key) ||
            value instanceof Y.AbstractType ||
            current instanceof Y.AbstractType ||
            !isDeepStrictEqual(current, value)
        ) {
            live.set(key, copy(value));
        }
    });
}

function clear(type: Y.Map<unknown> | Y.Array<unknown> | Y.Text) {
    if (type instanceof Y.Map) {
        [...type.keys()].forEach((key) => type.delete(key));
    } else {
        type.delete(0, type.length);
    }
}

/**
 * Brings `live` in line with the content `snapshot` holds, as one change that every
 * copy receives like any other, so nothing is rewritten in place and the result can
 * itself be restored over. Entries that already match are left alone. The `versions`
 * marks are kept, so editors older than one that wrote to the document stay view only.
 */
export function restoreContent(live: Y.Doc, snapshot: Y.Doc) {
    const names = new Set([...live.share.keys(), ...snapshot.share.keys()]);

    live.transact(() => {
        for (const name of names) {
            if (KEPT_ROOTS.has(name)) continue;

            const fromSnapshot = snapshot.share.get(name);
            const kind = fromSnapshot && rootKind(fromSnapshot);
            const liveKind = live.share.has(name) ? rootKind(live.share.get(name)!) : undefined;

            if (!kind) {
                if (liveKind) clear(root(live, name, liveKind));
                continue;
            }
            if (liveKind && liveKind !== kind) {
                // A root keeps the type it was first read as; this cannot happen in practice.
                throw new Error(`The snapshot's ${name} is not a ${liveKind}`);
            }

            const target = root(live, name, kind);
            const source = root(snapshot, name, kind);

            if (kind === 'map') restoreMap(target as Y.Map<unknown>, source as Y.Map<unknown>);
            if (kind === 'array') {
                restoreArray(target as Y.Array<unknown>, source as Y.Array<unknown>);
            }
            if (kind === 'text') restoreText(target as Y.Text, source as Y.Text);
        }
    });
}

/** The newest document format that wrote to a document, or 0 when none says. */
export function newestVersion(doc: Y.Doc): number {
    const keys = [...doc.getMap('versions').keys()].map(Number).filter(Number.isFinite);

    return Math.max(0, ...keys);
}
