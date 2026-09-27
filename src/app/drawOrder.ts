import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';
import type { Shape } from './types';

type Ordered = Pick<Shape, 'id' | 'order'>;

const MAX_ORDER_LENGTH = 1000;
// Keys headed by 'A' are the bottom of the range, which no realistic editing
// reaches, and the library can generate an invalid key below them.
const ORDER_KEY = /^[B-Za-z][0-9A-Za-z]*$/;

export const orderAbove = (order: string | null): string => generateKeyBetween(order, null);

/** `count` ascending orders above `order`, or anywhere when it is null. */
export const ordersAbove = (order: string | null, count: number): string[] =>
    generateNKeysBetween(order, null, count);

/** `count` ascending orders below `order`, or anywhere when it is null. */
export const ordersBelow = (order: string | null, count: number): string[] =>
    generateNKeysBetween(null, order, count);

/** Returns `value` when it is a draw order the library can build on, otherwise undefined. */
export function validDrawOrder(value: unknown): string | undefined {
    if (typeof value !== 'string' || value.length > MAX_ORDER_LENGTH || !ORDER_KEY.test(value)) {
        return undefined;
    }

    try {
        orderAbove(value);
    } catch {
        return undefined;
    }

    return value;
}

export const byDrawingOrder = (a: Ordered, b: Ordered) => {
    if (a.order !== b.order) {
        return a.order < b.order ? -1 : 1;
    }

    return a.id < b.id ? -1 : 1;
};

export const inDrawingOrder = (items: Record<string, Ordered>) =>
    Object.values(items)
        .sort(byDrawingOrder)
        .map(({ id }) => id);

/**
 * Gives every item that shares its order with the one drawn below it a new order
 * between the shared one and the next, so the stacking stays and orders are unique.
 */
export function untie(items: Ordered[]): void {
    const sorted = [...items].sort(byDrawingOrder);
    let start = 0;

    while (start < sorted.length) {
        const { order } = sorted[start];
        let end = start + 1;

        while (end < sorted.length && sorted[end].order === order) {
            end++;
        }

        const tied = sorted.slice(start + 1, end);
        const orders = generateNKeysBetween(order, sorted[end]?.order ?? null, tied.length);

        tied.forEach((item, index) => {
            item.order = orders[index];
        });
        start = end;
    }
}
