import { Action } from 'overmind';
import { Position } from '../../app/types';

export const setStartPosition: Action<Position> = ({ state }, coords) => {
  state.events.pointer.startPosition = coords;
};

export const setCurrentPosition: Action<Position> = ({ state }, coords) => {
  state.events.pointer.currentPosition = coords;
};

export const updatePath: Action<Position> = ({ state }, coords) => {
  state.events.pointer.path.push(coords);
};

export const startDragging: Action<Position> = ({ actions, state }, coords) => {
  state.events.pointer.dragging = true;
  actions.setStartPosition(coords);
  actions.setCurrentPosition(coords);
  actions.updatePath(coords);
};

export const dragging: Action<Position> = ({ actions }, coords) => {
  actions.setCurrentPosition(coords);
  actions.updatePath(coords);
};

export const endDragging: Action = ({ state }) => {
  state.events.pointer.dragging = false;
};

export const resetDragging: Action = ({ state }) => {
  state.events.pointer.dragging = false;
  state.events.pointer.startPosition = { x: 0, y: 0 };
  state.events.pointer.currentPosition = { x: 0, y: 0 };
  state.events.pointer.path.length = 0;
};
