import { Position, Size } from '../app/types';

export interface Pointer {
  bottomRightPosition: Position;
  centre: Position;
  dragging: boolean;
  offset: Position;
  path: Position[];
  position: Position;
  radius: number;
  scaledBottomRightPosition: Position;
  scaledCentre: Position;
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
  typing: boolean;
  text: string;
}

export interface Events {
  pointer: Pointer;
  keyboard: Keyboard;
}
