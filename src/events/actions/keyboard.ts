import { ActionWithParam, Action } from 'src/app/types';
import { Context } from '../../app';
import { getCommands, getTools } from '../../app/actions/startup';
import { KeyPress, matchesShortcut } from '../shortcuts';

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
 * keep the browser from also acting on the keys. Presses are ignored outside the
 * designer, where the shapes they act on are not shown, while text is being typed,
 * and while a pointer gesture is in progress.
 */
export const pressShortcut = ({ state, actions }: Context, press: KeyPress): boolean => {
    if (
        state.currentPage !== 'designer' ||
        state.events.keyboard.typing ||
        state.events.pointer.dragging
    ) {
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

    if (command) {
        actions.runCommand(command);

        return true;
    }

    return false;
};
