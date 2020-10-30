import {
  bottomRightPosition,
  centre,
  offset,
  radius,
  scaledCentre,
  scaledCurrentPosition,
  scaledOffset,
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
    bottomRightPosition,
    centre,
    dragging: false,
    offset,
    path: [],
    position: { x: 0, y: 0 },
    radius,
    scaledCentre,
    scaledCurrentPosition,
    scaledOffset,
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
