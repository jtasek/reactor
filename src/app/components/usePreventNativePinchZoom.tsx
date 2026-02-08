import { useEffect } from 'react';

export const usePreventNativePinchZoom = () => {
    const handleMouseWheel = (event: WheelEvent) => {
        if (event.ctrlKey) {
            event.preventDefault();
        }
        console.log('Prevent native pinch zoom.');
    };

    useEffect(() => {
        document.addEventListener('wheel', handleMouseWheel, {
            passive: false
        });

        return () => document.removeEventListener('wheel', handleMouseWheel);
    }, []);
};
