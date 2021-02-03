import { Position, Size } from '../app/types';

export interface Pointer {
  centre: Position;
  dragging: boolean;
  offset: Position;
  path: Position[];
  position: Position;
  radius: number;
  scaledCentre: Position;
  scaledCurrentPosition: Position;
  scaledOffset: Position;
  scaledPath: Position[];
  scaledRadius: number;
  scaledSize: Size;
  scaledStartPosition: Position;
  scaledTopLeftPosition: Position;
  size: Size;
  startPosition: Position;
  topLeftPosition: Position;
  bottomRightPosition: Position;
}

export interface Keyboard {
  typing: boolean;
  text: string;
}

export interface Events {
  pointer: Pointer;
  keyboard: Keyboard;
}
