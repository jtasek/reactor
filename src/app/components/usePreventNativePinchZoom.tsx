import { useEffect } from 'react';
import { useLog } from 'src/app/hooks';

export const usePreventNativePinchZoom = () => {
    const log = useLog();

    useEffect(() => {
        const handleMouseWheel = (event: WheelEvent) => {
            if (event.ctrlKey) {
                event.preventDefault();
            }
            log('Prevent native pinch zoom.');
        };

        document.addEventListener('wheel', handleMouseWheel, {
            passive: false
        });

        return () => document.removeEventListener('wheel', handleMouseWheel);
    }, [log]);
};
