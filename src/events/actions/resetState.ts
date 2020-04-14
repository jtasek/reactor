import { Action } from 'overmind';

export const resetState: Action = ({ state }) => {
  state.events.pointer = {
    dragging: false,
    initialPosition: { x: 0, y: 0 },
    position: { x: 0, y: 0 },
    path: []
  };
};
