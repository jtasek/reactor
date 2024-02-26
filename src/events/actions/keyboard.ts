import { Action, ExecuteAction } from 'src/app/types';

export const typing: Action<string> = (
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
export const startTyping: ExecuteAction = (
  {
    state: {
      events: { keyboard }
    }
  }) => {
  keyboard.text = EMPTY_STRING;
  keyboard.typing = true;
};

export const endTyping: ExecuteAction = (
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

export const keyDown: Action<KeyboardEvent> = (
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

export const keyUp: Action<KeyboardEvent> = (
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
