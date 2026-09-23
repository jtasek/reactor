import { Point, ResizeHandlerType, Size } from '../app/types';

/** Selection flags captured when a gesture starts, restored if it is canceled. */
export type SelectionSnapshot = Record<string, boolean>;

/**
 * The pointer gesture in progress. Every active gesture is owned by the pointer
 * that started it; input from any other pointer is ignored until it ends.
 */
export type Gesture =
    | { kind: 'idle' }
    | { kind: 'drawing'; pointerId: number }
    | { kind: 'marquee'; pointerId: number; selection: SelectionSnapshot }
    | { kind: 'moving'; pointerId: number; selection: SelectionSnapshot }
    | { kind: 'resizing'; pointerId: number; shapeId: string; handle: ResizeHandlerType }
    | { kind: 'rotating'; pointerId: number; shapeId: string };

/** A resize or rotate handle under the pointer when a gesture starts. */
export type HandleTarget = { shapeId: string; type: ResizeHandlerType | 'rotate' };

export interface Pointer {
    background: boolean;
    bottomRight: Point;
    center: Point;
    current: Point;
    dragging: boolean;
    gesture: Gesture;
    offset: Point;
    path: Point[];
    radius: number;
    size: Size;
    start: Point;
    topLeft: Point;
}

export interface Keyboard {
    altKey: boolean;
    ctrlKey: boolean;
    key: string;
    metaKey: boolean;
    shiftKey: boolean;
    text: string;
    typing: boolean;
}

export interface Events {
    keyboard: Keyboard;
    pointer: Pointer;
}
