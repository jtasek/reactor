import { Position, Size } from '../app/types';

export interface Pointer {
  centre: Position;
  currentPosition: Position;
  dragging: boolean;
  path: Position[];
  radius: number;
  scaledCentre: Position;
  scaledCurrentPosition: Position;
  scaledPath: Position[];
  scaledRadius: number;
  scaledSize: Size;
  scaledStartPosition: Position;
  scaledTopLeftPosition: Position;
  size: Size;
  startPosition: Position;
  topLeftPosition: Position;
}

export interface Keyboard {
  typing: boolean;
}

export interface Events {
  pointer: Pointer;
  keyboard: Keyboard;
}
