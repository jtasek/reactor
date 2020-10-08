import {
  centre,
  radius,
  scaledCentre,
  scaledCurrentPosition,
  scaledPath,
  scaledRadius,
  scaledSize,
  scaledStartPosition,
  scaledTopLeftPosition,
  size,
  topLeftPosition
} from './computed/pointer';
import { Events } from './types';

export const state: Events = {
  pointer: {
    centre,
    currentPosition: { x: 0, y: 0 },
    dragging: false,
    path: [],
    radius,
    scaledCentre,
    scaledCurrentPosition,
    scaledPath,
    scaledRadius,
    scaledSize,
    scaledStartPosition,
    scaledTopLeftPosition,
    size,
    startPosition: { x: 0, y: 0 },
    topLeftPosition
  },
  keyboard: {
    typing: false
  }
};
