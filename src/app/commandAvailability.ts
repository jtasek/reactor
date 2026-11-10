import { useMemo, useSyncExternalStore } from 'react';
import type { Command } from './types';

/**
 * Whether each registered command can run now, worked out in one place
 * (`CommandAvailability`) and read here by every button and menu that shows a
 * command. A guard read inside a button subscribes that button to everything
 * the guard reads, which for most guards is the whole selection and so every
 * shape; one reader for all guards subscribes once.
 */
let available: Record<string, boolean> = {};
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
};

/** Replaces what is known; readers hear of it only when a command's answer changed. */
export function publishCommandAvailability(next: Record<string, boolean>) {
    const ids = Object.keys(next);

    if (
        ids.length === Object.keys(available).length &&
        ids.every((id) => available[id] === next[id])
    ) {
        return;
    }

    available = next;
    listeners.forEach((listener) => listener());
}

/** Whether a command can run, as last published; false for one not registered. */
export const commandAvailable = (commandId: string) => available[commandId] ?? false;

/** Whether `command` can run now; re-renders only when that answer changes. */
export const useCommandEnabled = (command: Command) =>
    useSyncExternalStore(subscribe, () => commandAvailable(command.id));

/** Whether each of `commands` can run now, in their order. */
export const useCommandsEnabled = (commands: Command[]) => {
    const key = useSyncExternalStore(subscribe, () =>
        commands.map(({ id }) => (commandAvailable(id) ? '1' : '0')).join('')
    );

    return useMemo(() => [...key].map((flag) => flag === '1'), [key]);
};
