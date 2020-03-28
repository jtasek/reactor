import { Point } from '../app/types';

export interface Events {
  pointer: Pointer;
}

export interface Pointer {
  dragging: boolean;
  initialPosition: Point;
  path: Point[];
  position: Point;
}
