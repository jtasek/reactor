import { ActionWithParam, Action } from 'src/app/types';

export const typing: ActionWithParam<string> = (
  {
    state: {
      events: { keyboard }
    }
  },
  text
) => {
  keyboard.typing = true;
  keyboard.text = text;
};

const EMPTY_STRING = '';
export const startTyping: Action = (
  {
    state: {
      events: { keyboard }
    }
  }) => {
  keyboard.text = EMPTY_STRING;
  keyboard.typing = true;
};

export const endTyping: Action = (
  {
    state: {
      events: { keyboard }
    },
    actions
  }) => {
  actions.tools.executeToolCommands();

  keyboard.typing = false;
  keyboard.text = EMPTY_STRING;

  actions.tools.resetTools();
};

export const keyDown: ActionWithParam<KeyboardEvent> = (
  {
    state: {
      events: { keyboard }
    }
  },
  event
) => {
  keyboard.altKey = event.altKey;
  keyboard.ctrlKey = event.ctrlKey;
  keyboard.key = event.key;
  keyboard.metaKey = event.metaKey;
  keyboard.shiftKey = event.shiftKey;
};

export const keyUp: ActionWithParam<KeyboardEvent> = (
  {
    state: {
      events: { keyboard }
    }
  },
  event
) => {
  keyboard.altKey = event.altKey;
  keyboard.ctrlKey = event.ctrlKey;
  keyboard.key = event.key;
  keyboard.metaKey = event.metaKey;
  keyboard.shiftKey = event.shiftKey;
};
