import { Command } from '../types';
import { Context } from '../index';
import { getCommands } from './startup';

/** Runs `command` if its guard allows it now; returns whether it ran. */
export const runCommand = (context: Context, command: Command): boolean => {
    if (!command.canExecute(context)) {
        return false;
    }

    command.execute(context);

    return true;
};

/**
 * Runs the registered command whose id or name matches `input`, ignoring case
 * and surrounding spaces. Returns a message for the user when nothing matches or
 * the command cannot run now.
 */
export const submitCommandLine = (context: Context, input: string): string | undefined => {
    const text = input.trim();

    if (!text) {
        return undefined;
    }

    const command = getCommands().find(
        ({ id, name }) =>
            id.toLowerCase() === text.toLowerCase() || name.toLowerCase() === text.toLowerCase()
    );

    if (!command) {
        return `Unknown command: ${text}`;
    }

    return context.actions.runCommand(command)
        ? undefined
        : `${command.name} is not available right now`;
};
