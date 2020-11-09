import { Action } from 'src/app/types';

export const type: Action<Position> = ({ state }) => {
  state.events.keyboard.typing = true;
};
