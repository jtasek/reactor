import { useEffect } from 'react';
import { usePointerAdapter } from './usePointerAdapter';

export const usePointerDriver = () => {
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
        };
    }, []);
};
