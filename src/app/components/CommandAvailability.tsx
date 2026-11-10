import { FC, useLayoutEffect, useSyncExternalStore } from 'react';
import { commandsVersion, getCommands, subscribeToCommands } from '../actions/startup';
import { publishCommandAvailability } from '../commandAvailability';
import { useAppState } from '../hooks';

/**
 * Works out whether each command can run, for every button and menu at once.
 * Draws nothing. It is the one subscriber to what the guards read; while a
 * gesture is changing shapes it waits, as no command is taken mid-gesture and
 * guards that read geometry would otherwise run on every pointer move.
 */
export const CommandAvailability: FC = () => {
    const state = useAppState((state) => state);
    const { kind } = state.events.pointer.gesture;
    const waiting =
        kind !== 'idle' && kind !== 'marquee' && kind !== 'drawing' && kind !== 'pinching';

    useSyncExternalStore(subscribeToCommands, commandsVersion);

    const available = waiting
        ? null
        : Object.fromEntries(
              getCommands().map((command) => {
                  try {
                      return [command.id, command.canExecute({ state })];
                  } catch (error) {
                      console.error(error);
                      // A guard that cannot read a document mid-switch offers nothing.
                      return [command.id, false];
                  }
              })
          );

    useLayoutEffect(() => {
        if (available) {
            publishCommandAvailability(available);
        }
    });

    return null;
};
