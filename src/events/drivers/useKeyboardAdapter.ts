import { useCallback } from 'react';
import { useActions, useLog } from 'src/app/hooks';
import { isCanvasFocus, isTextEntry, takesArrowKey } from './helpers';

const keys = ({ altKey, code, ctrlKey, key, metaKey, repeat, shiftKey }: KeyboardEvent) => ({
    altKey,
    code,
    ctrlKey,
    key,
    metaKey,
    repeat,
    shiftKey
});

/** Keeps a lone Alt, held to measure, from the browser, which may focus its menu bar on it. */
const keepLoneAlt = (event: KeyboardEvent) => {
    if (event.key === 'Alt' && isCanvasFocus(event.target)) {
        event.preventDefault();
    }
};

export const useKeyboardAdapter = () => {
    const { keyDown, keyUp, pressShortcut, releaseKeys, releaseModifiers } = useActions().events;
    const log = useLog();

    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            log('keyDown', keys(event));
            keyDown(event);
            keepLoneAlt(event);

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
            keepLoneAlt(event);
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
