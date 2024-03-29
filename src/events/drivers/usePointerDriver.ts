import { useEffect } from 'react';
import { usePointerAdapter } from './usePointerAdapter';
import { useLog } from '../../app/hooks';

export const usePointerDriver = () => {
    const log = useLog();

    const {
        handleContextMenu,
        handleMouseWheel,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        handleTouchEnd,
        handleTouchMove,
        handleTouchStart
    } = usePointerAdapter();

    useEffect(() => {
        window.addEventListener('contextmenu', handleContextMenu);
        window.addEventListener('pointerdown', handlePointerDown);
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('touchcancel', handleTouchEnd);
        window.addEventListener('touchend', handleTouchEnd);
        window.addEventListener('touchmove', handleTouchMove);
        window.addEventListener('touchstart', handleTouchStart);
        window.addEventListener('wheel', handleMouseWheel);

        log('Pointer driver installed.');

        return () => {
            window.removeEventListener('contextmenu', handleContextMenu);
            window.removeEventListener('pointerdown', handlePointerDown);
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('touchcancel', handleTouchEnd);
            window.removeEventListener('touchend', handleTouchEnd);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('wheel', handleMouseWheel);

            log('Pointer driver removed.');
        };
    }, []);
};
