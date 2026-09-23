import {
    background,
    bottomRight,
    center,
    dragging,
    offset,
    radius,
    size,
    topLeft
} from './computed/pointer';
import { Events } from './types';

export const state: Events = {
    pointer: {
        background,
        bottomRight,
        center,
        current: { x: 0, y: 0 },
        dragging,
        gesture: { kind: 'idle' },
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
