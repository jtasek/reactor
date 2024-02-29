import { Position, Size } from '../app/types';

export interface Pointer {
    bottomRight: Position;
    center: Position;
    current: Position;
    dragging: boolean;
    offset: Position;
    path: Position[];
    radius: number;
    scaledBottomRight: Position;
    scaledCenter: Position;
    scaledCurrent: Position;
    scaledOffset: Position;
    scaledPath: Position[];
    scaledRadius: number;
    scaledSize: Size;
    scaledStart: Position;
    scaledTopLeft: Position;
    size: Size;
    start: Position;
    topLeft: Position;
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
