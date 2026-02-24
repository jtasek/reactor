import { bottomRight, center, offset, radius, size, topLeft } from './computed/pointer';
import { Events } from './types';

export const state: Events = {
    pointer: {
        bottomRight,
        center,
        current: { x: 0, y: 0 },
        dragging: false,
        offset,
        path: [],
        radius,
        size,
        start: { x: 0, y: 0 },
        topLeft
    },
    keyboard: {
        altKey: false,
        ctrlKey: false,
        key: '',
        metaKey: false,
        shiftKey: false,
        text: '',
        typing: false
    }
};
