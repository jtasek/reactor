import { string } from 'yargs';
import {
  bottomRightPosition,
  center,
  offset,
  radius,
  scaledCenter,
  scaledPosition,
  scaledOffset,
  scaledPath,
  scaledRadius,
  scaledSize,
  scaledBottomRightPosition,
  scaledStartPosition,
  scaledTopLeftPosition,
  size,
  topLeftPosition
} from './computed/pointer';
import { Events } from './types';

export const state: Events = {
  pointer: {
    bottomRightPosition,
    center,
    dragging: false,
    offset,
    path: [],
    position: { x: 0, y: 0 },
    radius,
    scaledCenter,
    scaledOffset,
    scaledPath,
    scaledPosition,
    scaledRadius,
    scaledSize,
    scaledBottomRightPosition,
    scaledStartPosition,
    scaledTopLeftPosition,
    size,
    startPosition: { x: 0, y: 0 },
    topLeftPosition
  },
  keyboard: {
    altKey: false,
    ctrlKey: false,
    key: '',
    metaKey: false,
    shiftKey: false,
    text: '',
    typing: false
  }
};
