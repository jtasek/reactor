import { useEffect } from 'react';
import { useActions, useLog } from 'src/app/hooks';

export const useKeyboardDriver = () => {
    const { keyDown, keyUp } = useActions().events;
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

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);
};
