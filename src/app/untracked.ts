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
