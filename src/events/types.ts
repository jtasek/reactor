import { Point, Size } from '../app/types';

export interface Pointer {
    bottomRight: Point;
    center: Point;
    current: Point;
    dragging: boolean;
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
