import { ActionWithParam, Position } from '../../app/types';

export const setStartPosition: ActionWithParam<Position> =  ({ state }, position) => {
  state.events.pointer.startPosition = position;
};

export const setCurrentPosition: ActionWithParam<Position> = ({ state }, position) => {
  state.events.pointer.position = position;
};

export const updatePath: ActionWithParam<Position> = ({ state }, position) => {
  state.events.pointer.path.push(position);
};

export const startDragging: ActionWithParam<Position> = ({ state }, position) => {
  const pointer = state.events.pointer;
  pointer.dragging = true;
  pointer.startPosition = position;
  pointer.position = position;
  pointer.path = [position];
};

export const dragging: ActionWithParam<Position>  = ({ state }, position) => {
  const pointer = state.events.pointer;
  pointer.position = position;
  pointer.path.push(position);
};

export const endDragging: ActionWithParam<Position>  = ({ state }) => {
  state.events.pointer.dragging = false;
};

export const resetDragging: ActionWithParam<Position> = ({ state }) => {
  const pointer = state.events.pointer;
  pointer.dragging = false;
  pointer.startPosition = { x: 0, y: 0 };
  pointer.position = { x: 0, y: 0 };
  pointer.path.length = 0;
};
