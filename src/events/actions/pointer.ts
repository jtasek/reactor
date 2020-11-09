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
  state.events.pointer.dragging = true;
  state.events.pointer.startPosition = coords;
  state.events.pointer.position = coords;
  state.events.pointer.path.push(coords);
};

export const dragging: Action<Position> = ({ state }, coords) => {
  state.events.pointer.position = coords;
  state.events.pointer.path.push(coords);
};

export const endDragging: Action = ({ state }) => {
  state.events.pointer.dragging = false;
};

export const resetDragging: Action = ({ state }) => {
  state.events.pointer.dragging = false;
  state.events.pointer.startPosition = { x: 0, y: 0 };
  state.events.pointer.position = { x: 0, y: 0 };
  state.events.pointer.path.length = 0;
};
