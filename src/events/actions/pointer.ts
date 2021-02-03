import { Action, Position } from '../../app/types';

export const setStartPosition: Action<Position> = ({ state }, coords) => {
  state.events.pointer.startPosition = coords;
};

export const setCurrentPosition: Action<Position> = ({ state }, coords) => {
  state.events.pointer.position = coords;
};

export const updatePath: Action<Position> = ({ state }, coords) => {
  state.events.pointer.path.push(coords);
};

export const startDragging: Action<Position> = ({ state }, coords) => {
  const pointer = state.events.pointer;
  pointer.dragging = true;
  pointer.startPosition = coords;
  pointer.position = coords;
  pointer.path = [coords];
};

export const dragging: Action<Position> = ({ state }, coords) => {
  const pointer = state.events.pointer;
  pointer.position = coords;
  pointer.path.push(coords);
};

export const endDragging: Action = ({ state }) => {
  state.events.pointer.dragging = false;
};

export const resetDragging: Action = ({ state }) => {
  const pointer = state.events.pointer;
  pointer.dragging = false;
  pointer.startPosition = { x: 0, y: 0 };
  pointer.position = { x: 0, y: 0 };
  pointer.path.length = 0;
};
