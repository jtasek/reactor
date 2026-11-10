import { FC, useLayoutEffect } from 'react';
import { getCommands } from 'src/app/actions/startup';
import { publishCommandAvailability } from 'src/app/commandAvailability';
import { useReaction } from 'src/app/hooks';

/**
 * Works out whether each command can run, for every button and menu at once.
 * Draws nothing. It is the one subscriber to what the guards read, and answers
 * as the store changes, so buttons render with the change that enabled them: a
 * dialog closing hands the focus back to a button that is already enabled.
 * While a gesture is changing shapes it waits, as no command is taken
 * mid-gesture and guards that read geometry would run on every pointer move.
 */
export const CommandAvailability: FC = () => {
    const reaction = useReaction();

    useLayoutEffect(
        () =>
            reaction(
                (state) => {
                    const { kind } = state.events.pointer.gesture;

                    if (
                        kind !== 'idle' &&
                        kind !== 'marquee' &&
                        kind !== 'drawing' &&
                        kind !== 'pinching'
                    ) {
                        return null;
                    }

                    return Object.fromEntries(
                        getCommands().map((command) => {
                            try {
                                return [command.id, command.canExecute({ state })];
                            } catch (error) {
                                // A guard that cannot read a document mid-switch offers nothing.
                                console.error(error);

                                return [command.id, false];
                            }
                        })
                    );
                },
                (available) => {
                    if (available) {
                        publishCommandAvailability(available);
                    }
                },
                { immediate: true }
            ),
        [reaction]
    );

    return null;
};
