import { Position, Size } from '../app/types';

export interface Pointer {
  bottomRightPosition: Position;
  center: Position;
  dragging: boolean;
  offset: Position;
  path: Position[];
  position: Position;
  radius: number;
  scaledBottomRightPosition: Position;
  scaledCenter: Position;
  scaledOffset: Position;
  scaledPath: Position[];
  scaledPosition: Position;
  scaledRadius: number;
  scaledSize: Size;
  scaledStartPosition: Position;
  scaledTopLeftPosition: Position;
  size: Size;
  startPosition: Position;
  topLeftPosition: Position;
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
  pointer: Pointer;
  keyboard: Keyboard;
}
