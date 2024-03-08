import { useEffect } from 'react';
import { useKeyboardAdapter } from './useKeyboardAdapter';

export const useKeyboardDriver = () => {
    const { handleKeyDown, handleKeyUp } = useKeyboardAdapter();

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);
};
