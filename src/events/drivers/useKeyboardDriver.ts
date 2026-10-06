import { useEffect } from 'react';
import { useKeyboardAdapter } from './useKeyboardAdapter';
import { useLog } from 'src/app/hooks';

export const useKeyboardDriver = () => {
    const { handleKeyDown, handleKeyUp, handleBlur } = useKeyboardAdapter();
    const log = useLog();

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleBlur);

        log('Keyboard driver installed.');

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);

            log('Keyboard driver removed.');
        };
    }, [handleKeyDown, handleKeyUp, log, handleBlur]);
};
