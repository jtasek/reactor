import { untracked } from './untracked';

const snapshots = new WeakMap<object, Map<string, object>>();
const dates = new WeakMap<Date, Date>();
const fingerprints = new WeakMap<object, string>();
const omissions = new Map<string, ReadonlySet<string>>();
/** Copies are shared between evaluations, so a write would leave a stale fingerprint. */
const FREEZE = process.env.NODE_ENV !== 'production';

/** Read every nested field through Overmind, but retain unchanged immutable branches. */
export function snapshot<T>(value: T): T {
    if (value instanceof Date) {
        const owner = untracked(value);
        const previous = dates.get(owner);
        if (previous && Object.is(previous.getTime(), value.getTime())) {
            return previous as T;
        }
        const result = new Date(value.getTime());
        dates.set(owner, result);

        return result as T;
    }
    if (!value || typeof value !== 'object') {
        return value;
    }

    return copy(value, '') as T;
}

/** Selection and hover never become geometry dependencies. */
export function artwork<T extends object>(value: T, omit: string[] = []): T {
    return copy(value, ['selected', 'active', ...omit].join(',')) as T;
}

function copy(value: object, profile: string): object {
    const owner = untracked(value);
    const cached = snapshots.get(owner) ?? new Map<string, object>();
    const previous = cached.get(profile) as Record<string, unknown> | undefined;
    const omitted = omissions.get(profile) ?? omissionsFor(profile);
    const keys = Object.keys(value)
        .sort()
        .filter((key) => !omitted.has(key));
    const source = value as Record<string, unknown>;
    // Read even on cache hits: a new derived evaluation needs all its subscriptions.
    const entries = keys.map((key) => [key, snapshot(source[key])] as const);
    if (
        previous &&
        Object.keys(previous).length === keys.length &&
        entries.every(
            ([key, item]) =>
                Object.prototype.hasOwnProperty.call(previous, key) &&
                Object.is(previous[key], item)
        ) &&
        (!Array.isArray(value) || previous.length === value.length)
    ) {
        return previous;
    }
    const result = Array.isArray(value)
        ? Object.assign(new Array(value.length), Object.fromEntries(entries))
        : Object.fromEntries(entries);
    fingerprints.set(result, signature(geometryKey(result)));
    if (FREEZE) {
        Object.freeze(result);
    }
    cached.set(profile, result);
    snapshots.set(owner, cached);

    return result;
}

function omissionsFor(profile: string) {
    const omitted = new Set(profile ? profile.split(',') : []);
    omissions.set(profile, omitted);

    return omitted;
}

/** Snapshot fingerprints replace repeated serialization of their immutable contents. */
export function geometryKey(value: unknown): string {
    return JSON.stringify(value, (_key, item: unknown) => {
        const fingerprint = item && typeof item === 'object' ? fingerprints.get(item) : undefined;

        return fingerprint === undefined ? item : { snapshot: fingerprint };
    });
}

/**
 * Compact content signature (53-bit cyrb53 plus length), avoiding retained JSON
 * copies alongside the immutable snapshots.
 */
export function signature(text: string) {
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
