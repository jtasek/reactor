import { Action, Position } from '../../app/types';

export const setStartPosition: Action<Position> =  ({ state }, position) => {
  state.events.pointer.startPosition = position;
};

export const setCurrentPosition: Action<Position> = ({ state }, position) => {
  state.events.pointer.position = position;
};

export const updatePath: Action<Position> = ({ state }, position) => {
  state.events.pointer.path.push(position);
};

export const startDragging: Action<Position> = ({ state }, position) => {
  const pointer = state.events.pointer;
  pointer.dragging = true;
  pointer.startPosition = position;
  pointer.position = position;
  pointer.path = [position];
};

export const dragging: Action<Position>  = ({ state }, position) => {
  const pointer = state.events.pointer;
  pointer.position = position;
  pointer.path.push(position);
};

export const endDragging: Action<Position>  = ({ state }) => {
  state.events.pointer.dragging = false;
};

export const resetDragging: Action<Position> = ({ state }) => {
  const pointer = state.events.pointer;
  pointer.dragging = false;
  pointer.startPosition = { x: 0, y: 0 };
  pointer.position = { x: 0, y: 0 };
  pointer.path.length = 0;
};
