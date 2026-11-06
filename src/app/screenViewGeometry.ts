import { projectScreenViews } from './screenProjection';
import { untracked } from './untracked';
import type { Document, VariableContext } from './types';

const ORIGIN = { x: 0, y: 0 };
const projections = new WeakMap<
    Document,
    { key: string; views: ReturnType<typeof projectScreenViews> }
>();

/**
 * A compact signature of the authored inputs (53-bit cyrb53 plus length), so each
 * document keeps a few bytes rather than a JSON copy of its artwork.
 */
function signature(text: string) {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        h1 = Math.imul(h1 ^ code, 2654435761);
        h2 = Math.imul(h2 ^ code, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    return `${text.length}:${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)}`;
}

/** Read nested fields through the tracking proxy; Overmind json() deliberately bypasses it. */
function snapshot<T>(value: T): T {
    if (value instanceof Date) {
        return new Date(value.getTime()) as T;
    }
    if (Array.isArray(value)) {
        return value.map(snapshot) as T;
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.keys(value)
                .sort()
                .map((key) => [key, snapshot(value[key as keyof T])])
        ) as T;
    }

    return value;
}

/** Copy authored fields without subscribing geometry to selection or hover. */
function artwork<T extends object>(record: T, omit: string[] = []): T {
    return Object.fromEntries(
        Object.keys(record)
            .sort()
            .filter((key) => key !== 'selected' && key !== 'active' && !omit.includes(key))
            .map((key) => [key, snapshot(record[key as keyof T])])
    ) as T;
}

function records<T extends object>(items: Record<string, T>): Record<string, T> {
    return Object.fromEntries(Object.entries(items).map(([id, item]) => [id, artwork(item)]));
}

/**
 * Called by an Overmind derived value: authored changes invalidate the snapshot,
 * and cache hits replay its dependencies to every reader. Never memoize a mutable
 * document's identity.
 *
 * The projection sees only the snapshot below, never the raw document, so it cannot
 * read a field the cache does not track. Derived fields such as `frameLayout` and
 * `frameStates` are absent and computed from the snapshot. If projection code needs
 * another document field, add it to `inputs`; without it the field reads undefined
 * and tests fail instead of views silently drawing stale artwork.
 */
export function resolveScreenViewGeometry(document: Document, simulation?: VariableContext) {
    const frames = Object.fromEntries(
        Object.entries(document.frames).map(([id, frame]) => [
            id,
            frame.kind === 'view'
                ? {
                      ...artwork(frame, ['position', 'bindings']),
                      bindings: snapshot(frame.bindings ?? {}),
                      position: ORIGIN
                  }
                : artwork(frame)
        ])
    );

    if (!Object.values(frames).some((frame) => frame.kind === 'view' && frame.visible)) {
        projections.delete(untracked(document));

        return [];
    }

    const inputs = {
        frames,
        shapes: records(document.shapes),
        shapesIds: [...document.shapesIds],
        groups: records(document.groups),
        layers: records(document.layers),
        components: Object.fromEntries(
            Object.entries(document.components).map(([id, component]) => [
                id,
                {
                    ...artwork(component, ['sourceShapes']),
                    ...(component.sourceShapes
                        ? { sourceShapes: records(component.sourceShapes) }
                        : {})
                }
            ])
        ),
        variables: snapshot(document.variables),
        dimensions: snapshot(document.dimensions),
        shownLayerId: document.shownLayerId
    };

    // Adding/removing a local document field invalidates Overmind's parent path.
    // Compare authored inputs only on those derived misses, never on every render.
    const modes = snapshot(simulation);
    const key = signature(JSON.stringify([inputs, modes]));
    const owner = untracked(document);
    const cached = projections.get(owner);

    if (cached?.key === key) {
        return cached.views;
    }

    const views = projectScreenViews(
        { id: owner.id, ...inputs } as unknown as Document,
        modes,
        ORIGIN
    );
    projections.set(owner, { key, views });

    return views;
}
