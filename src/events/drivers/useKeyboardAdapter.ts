import { useCallback } from 'react';
import { useActions, useLog } from 'src/app/hooks';
import { isTextEntry, takesArrowKey } from './helpers';

const keys = ({ altKey, code, ctrlKey, key, metaKey, repeat, shiftKey }: KeyboardEvent) => ({
    altKey,
    code,
    ctrlKey,
    key,
    metaKey,
    repeat,
    shiftKey
});

export const useKeyboardAdapter = () => {
    const { keyDown, keyUp, pressShortcut, releaseKeys, releaseModifiers } = useActions().events;
    const log = useLog();

    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            log('keyDown', keys(event));
            keyDown(event);

            if (isTextEntry(event.target) || takesArrowKey(event.target, event.key)) {
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
            releaseKeys();
        },
        [keyUp, log, releaseKeys]
    );

    const handleBlur = useCallback(() => {
        releaseKeys();
        releaseModifiers();
    }, [releaseKeys, releaseModifiers]);

    return { handleKeyDown, handleKeyUp, handleBlur };
};
