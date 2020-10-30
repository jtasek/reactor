import { Action } from 'overmind';

export const type: Action<Position> = ({ state }) => {
  state.events.keyboard.typing = true;
};
