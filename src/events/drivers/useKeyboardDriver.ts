import { useEffect } from 'react';
import { useKeyboardAdapter } from './useKeyboardAdapter';
import { useLog } from '../../app/hooks';

export const useKeyboardDriver = () => {
    const { handleKeyDown, handleKeyUp } = useKeyboardAdapter();
    const log = useLog();

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        log('Keyboard driver installed.');

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);

            log('Keyboard driver removed.');
        };
    }, []);
};
