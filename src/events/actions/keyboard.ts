import { ActionWithParam, Action } from 'src/app/types';
import { Context } from 'src/app';
import { getCommands, getTools } from 'src/app/actions/startup';
import { KeyPress, matchesShortcut } from '../shortcuts';
import { takesEditorInput } from '../input';

export const typing: ActionWithParam<string> = (
    {
        state: {
            events: { keyboard }
        }
    },
    text
) => {
    if (keyboard.typing) {
        keyboard.text = text;
    }
};

const EMPTY_STRING = '';

export const startTyping: Action = ({
    state: {
        events: { keyboard }
    }
}) => {
    keyboard.typing = true;
};

export const endTyping: Action = ({
    state: {
        events: { keyboard }
    }
}) => {
    keyboard.typing = false;
    keyboard.text = EMPTY_STRING;
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

/**
 * Activates the tool or runs the command bound to a key press. Returns whether a
 * shortcut matched — even when its command cannot run now — so the caller can
 * keep the browser from also acting on the keys. A command a clipboard event runs
 * is left to the browser.
 */
export const pressShortcut = ({ state, actions }: Context, press: KeyPress): boolean => {
    if (!takesEditorInput(state)) {
        return false;
    }

    const matches = ({ shortcut }: { shortcut?: string }) =>
        shortcut !== undefined && matchesShortcut(shortcut, press);
    const tool = getTools().find(matches);

    if (tool) {
        actions.tools.activateTool(tool.id);

        return true;
    }

    const command = getCommands().find(matches);

    // Left to the browser, whose clipboard event runs the command.
    if (command?.clipboardEvent) {
        return false;
    }

    if (command) {
        actions.runCommand(command);

        return true;
    }

    return false;
};
