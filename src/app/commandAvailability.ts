import { useSyncExternalStore } from 'react';
import type { Command } from './types';

/**
 * Whether each registered command can run now, worked out in one place
 * (`CommandAvailability`, which the editor page renders) and read here by every
 * button and menu that shows a command. A page that shows command buttons
 * renders `CommandAvailability`; without it every command reads as unavailable. A guard read inside a button subscribes that button to everything
 * the guard reads, which for most guards is the whole selection and so every
 * shape; one reader for all guards subscribes once.
 */
let available: Record<string, boolean> = {};
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
    listeners.add(listener);

    return () => void listeners.delete(listener);
};

/** Replaces what is known. A reader renders again only if its own answer changed. */
export function publishCommandAvailability(next: Record<string, boolean>) {
    available = next;
    listeners.forEach((listener) => listener());
}

/** Whether a command can run, as last published; false for one not registered. */
export const commandAvailable = (commandId: string) => !!available[commandId];

/** Whether `command` can run now; re-renders only when that answer changes. */
export const useCommandEnabled = (command: Command) =>
    useSyncExternalStore(subscribe, () => !!available[command.id]);

/** Whether each of `commands` can run now, in their order. */
export const useCommandsEnabled = (commands: Command[]) => {
    // A string, so the same answers are the same snapshot.
    const key = useSyncExternalStore(subscribe, () =>
        commands.map(({ id }) => (available[id] ? 1 : 0)).join('')
    );

    return [...key].map((flag) => flag === '1');
};
