import { useCallback } from 'react';
import { useActions, useLog } from 'src/app/hooks';
import { isTextEntry } from './helpers';

const keys = ({ altKey, code, ctrlKey, key, metaKey, shiftKey }: KeyboardEvent) => ({
    altKey,
    code,
    ctrlKey,
    key,
    metaKey,
    shiftKey
});

export const useKeyboardAdapter = () => {
    const { keyDown, keyUp, pressShortcut } = useActions().events;
    const log = useLog();

    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            log('keyDown', keys(event));
            keyDown(event);

            if (isTextEntry(event.target)) {
                return;
            }

            if (pressShortcut(keys(event))) {
                event.preventDefault();
            }
        },
        [keyDown, log, pressShortcut]
    );

    const handleKeyUp = useCallback(
        (event: KeyboardEvent) => {
            log('keyUp', keys(event));
            keyUp(event);
        },
        [keyUp, log]
    );

    return { handleKeyDown, handleKeyUp };
};
