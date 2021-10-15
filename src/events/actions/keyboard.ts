import { Action } from 'src/app/types';

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

export const startTyping: Action = ({
  state: {
    events: { keyboard }
  }
}) => {
  keyboard.text = '';
  keyboard.typing = true;
};

export const endTyping: Action = ({
  state: {
    events: { keyboard }
  },
  actions
}) => {
  actions.tools.executeToolCommand();

  keyboard.typing = false;
  keyboard.text = '';

  actions.tools.resetTools();
};

export const keyPressed: Action = (
  {
    state: {
      events: { keyboard }
    }
  },
  event: any
) => {
  keyboard.altKey = event.altKey;
  keyboard.ctrlKey = event.ctrlKey;
  keyboard.key = event.key;
  keyboard.metaKey = event.metaKey;
  keyboard.shiftKey = event.shiftKey;
};
