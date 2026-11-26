import { IS_PROXY, VALUE } from 'proxy-state-tree';

/**
 * The plain value behind a store value, read without the store tracking each
 * access: for loops that only read thousands of entries. Never write to it, as
 * changes made through it are neither tracked nor shared.
 */
export function untracked<T extends object>(value: T): T {
    const proxied = value as T & { [IS_PROXY]?: boolean; [VALUE]?: T };

    return proxied[IS_PROXY] ? (proxied[VALUE] ?? value) : value;
}

/**
 * Deletes `key` only when `object` has it. The store tells everything that read
 * a key about each delete of it, even of a key that is not there, so deleting
 * an absent key would render all of them again.
 */
export function deleteIfPresent<T extends object>(object: T, key: keyof T) {
    if (key in object) {
        delete (object as Partial<T>)[key];
    }
}

/**
 * Writes `value` to `key` only when it differs from what is there. Every write
 * marks the derived values that read the key as changed, even one of the same
 * value, so they would work themselves out again on their next read.
 */
export function setIfChanged<T extends object, K extends keyof T>(object: T, key: K, value: T[K]) {
    const current = object[key];
    const same =
        current === value ||
        (typeof current === 'object' &&
            typeof value === 'object' &&
            current !== null &&
            value !== null &&
            JSON.stringify(current) === JSON.stringify(value));

    if (!same) {
        object[key] = value;
    }
}
