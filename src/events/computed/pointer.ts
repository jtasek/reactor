import { derived } from 'overmind';
import { Application, Point, Size } from 'src/app/types';
import { Pointer } from '../types';

export const center = derived<Pointer, Application, Point>(({ current, start }) => {
    return {
        x: start.x + (current.x - start.x) / 2,
        y: start.y + (current.y - start.y) / 2
    };
});

export const offset = derived<Pointer, Application, Point>(({ current, start }) => {
    return {
        x: current.x - start.x,
        y: current.y - start.y
    };
});

export const radius = derived<Pointer, Application, number>(({ center, start }) => {
    const x = center.x - start.x;
    const y = center.y - start.y;

    return Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
});

export const size = derived<Pointer, Application, Size>(({ current, start }) => {
    return {
        width: Math.abs(current.x - start.x),
        height: Math.abs(current.y - start.y)
    };
});

export const bottomRight = derived<Pointer, Application, Point>(({ current, start }) => {
    return {
        x: start.x > current.x ? start.x : current.x,
        y: start.y > current.y ? start.y : current.y
    };
});

export const topLeft = derived<Pointer, Application, Point>((pointer) => {
    const { current, start } = pointer;

    return {
        x: start.x > current.x ? current.x : start.x,
        y: start.y > current.y ? current.y : start.y
    };
});
