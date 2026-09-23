import { useActions, useLog } from '../../app/hooks';
import { isTextEntry } from './helpers';

export const useKeyboardAdapter = () => {
    const { keyDown, keyUp, pressShortcut } = useActions().events;
    const log = useLog();

    const handleKeyDown = (event: KeyboardEvent) => {
        log('keyDown', {
            altKey: event.altKey,
            ctrlKey: event.ctrlKey,
            key: event.key,
            metaKey: event.metaKey,
            shiftKey: event.shiftKey
        });
        keyDown(event);

        if (isTextEntry(event.target)) {
            return;
        }

        const { key, altKey, ctrlKey, metaKey, shiftKey } = event;

        if (pressShortcut({ key, altKey, ctrlKey, metaKey, shiftKey })) {
            event.preventDefault();
        }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
        log('keyDown', {
            altKey: event.altKey,
            ctrlKey: event.ctrlKey,
            key: event.key,
            metaKey: event.metaKey,
            shiftKey: event.shiftKey
        });
        keyUp(event);
    };
    return { handleKeyDown, handleKeyUp };
};
