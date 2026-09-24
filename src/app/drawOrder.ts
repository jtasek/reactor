import { generateKeyBetween } from 'fractional-indexing';
import type { Shape } from './types';

type Ordered = Pick<Shape, 'id' | 'order'>;

const BASE_62 = /^[0-9A-Za-z]+$/;

export const orderAbove = (order: string | null): string => generateKeyBetween(order, null);

export function isDrawOrder(value: unknown): value is string {
    if (typeof value !== 'string' || !BASE_62.test(value)) {
        return false;
    }

    try {
        orderAbove(value);
    } catch {
        return false;
    }

    return true;
}

export const byDrawingOrder = (a: Ordered, b: Ordered) => {
    if (a.order !== b.order) {
        return a.order < b.order ? -1 : 1;
    }

    return a.id < b.id ? -1 : 1;
};
