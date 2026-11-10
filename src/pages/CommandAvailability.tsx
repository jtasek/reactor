import { FC, useLayoutEffect } from 'react';
import { getCommands } from 'src/app/actions/startup';
import { publishCommandAvailability } from 'src/app/commandAvailability';
import { useReaction } from 'src/app/hooks';
import type { Context } from 'src/app';
import { storeOf } from 'src/app/storeOf';

type State = Context['state'];

/** Whether each command can run, or null while a gesture is changing shapes. */
function readAvailability(state: State) {
    const { kind } = state.events.pointer.gesture;

    if (kind !== 'idle' && kind !== 'marquee' && kind !== 'drawing' && kind !== 'pinching') {
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
}

/**
 * Works out whether each command can run, for every button and menu at once,
 * from the store behind `reaction`. It is the one subscriber to what the guards read, and answers
 * as the store changes, so buttons render with the change that enabled them: a
 * dialog closing hands the focus back to a button that is already enabled.
 * While a gesture is changing shapes it waits, as no command is taken
 * mid-gesture and guards that read geometry would run on every pointer move.
 * Returns how to stop.
 *
 * Each answer is tracked afresh. An Overmind reaction keeps every path it has
 * ever read, so once each shape had been selected (after a paste, say) it stayed
 * subscribed to all of them and every click re-subscribed thousands of paths.
 */
export function watchCommandAvailability(reaction: Context['reaction']) {
    const store = storeOf(reaction);
    let stopListening: (() => void) | undefined;
    let stopped = false;

    const answer = () => {
        stopListening?.();

        const tree = store.getTrackStateTree();
        let available: ReturnType<typeof readAvailability> = null;

        // A throw here would leave the tree tracking every later read and end
        // the watching, so a failed answer offers nothing and waits for a change.
        tree.trackScope(() => {
            try {
                available = readAvailability(tree.state as State);
            } catch (error) {
                console.error(error);
                available = {};
            }
        });
        stopListening = tree.subscribe(() => {
            if (!stopped) {
                answer();
            }
        });

        if (available) {
            publishCommandAvailability(available);
        }
    };

    answer();

    return () => {
        stopped = true;
        stopListening?.();
    };
}

/** Answers for the app's store while mounted. Draws nothing. */
export const CommandAvailability: FC = () => {
    const reaction = useReaction();

    useLayoutEffect(() => watchCommandAvailability(reaction), [reaction]);

    return null;
};
