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
    const { holdSpace, keyDown, keyUp, pressShortcut, releaseKeys, releaseModifiers } =
        useActions().events;
    const log = useLog();

    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            log('keyDown', keys(event));
            keyDown(event);
            keepLoneAlt(event);

            if (
                event.defaultPrevented ||
                event.isComposing ||
                isTextEntry(event.target) ||
                takesArrowKey(event.target, event.key)
            ) {
                return;
            }

            // Over the canvas, Space pans instead of pressing a focused button.
            if (event.code === 'Space' && holdSpace(true)) {
                event.preventDefault();

                return;
            }

            if (pressShortcut(keys(event))) {
                event.preventDefault();
            }
        },
        [holdSpace, keyDown, log, pressShortcut]
    );

    const handleKeyUp = useCallback(
        (event: KeyboardEvent) => {
            log('keyUp', keys(event));
            keyUp(event);
            keepLoneAlt(event);
            releaseKeys();
            if (event.code === 'Space') {
                holdSpace(false);
            }
        },
        [holdSpace, keyUp, log, releaseKeys]
    );

    const handleBlur = useCallback(() => {
        releaseKeys();
        releaseModifiers();
    }, [releaseKeys, releaseModifiers]);

    return { handleKeyDown, handleKeyUp, handleBlur };
};
