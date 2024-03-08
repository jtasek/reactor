import { useActions, useLog } from '../../app/hooks';

export const useKeyboardAdapter = () => {
    const { keyDown, keyUp } = useActions().events;
    const log = useLog();

    log('useKeyboardDriver()');

    const handleKeyDown = (event: KeyboardEvent) => {
        log('keyDown', {
            altKey: event.altKey,
            ctrlKey: event.ctrlKey,
            key: event.key,
            metaKey: event.metaKey,
            shiftKey: event.shiftKey
        });
        keyDown(event);
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
