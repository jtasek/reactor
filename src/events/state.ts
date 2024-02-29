import {
    bottomRight,
    center,
    offset,
    radius,
    scaledCenter,
    scaledCurrent,
    scaledOffset,
    scaledPath,
    scaledRadius,
    scaledSize,
    scaledBottomRight,
    scaledStart,
    scaledTopLeft,
    size,
    topLeft
} from './computed/pointer';
import { Events } from './types';

export const state: Events = {
    pointer: {
        bottomRight,
        center,
        dragging: false,
        offset,
        path: [],
        current: { x: 0, y: 0 },
        radius,
        scaledCenter,
        scaledOffset,
        scaledPath,
        scaledCurrent,
        scaledRadius,
        scaledSize,
        scaledBottomRight,
        scaledStart,
        scaledTopLeft,
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
