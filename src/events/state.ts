import { Events } from './types';

export const state: Events = {
  pointer: {
    position: {
      x: 0,
      y: 0
    },
    initialPosition: {
      x: 0,
      y: 0
    },
    dragging: false,
    path: []
  }
};
