import { Action } from 'src/app/types';

export const typing: Action<string> = ({ state }, text) => {
  state.events.keyboard.typing = true;
  state.events.keyboard.text = text;
};

export const startTyping: Action = ({ state }) => {
  console.log('start typing');

  state.events.keyboard.text = '';
  state.events.keyboard.typing = true;
};

export const endTyping: Action = ({ state, actions }) => {
  console.log('end typing');

  actions.tools.executeToolCommand();
  state.events.keyboard.typing = false;
  state.events.keyboard.text = '';
  actions.tools.resetTools();
};
