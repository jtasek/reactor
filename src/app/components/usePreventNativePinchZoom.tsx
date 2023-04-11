import { useEffect } from 'react';

export const usePreventNativePinchZoom = () => {
  const handleMouseWheel = (event) => {
    if (event.ctrlKey) {
      event.preventDefault();
    }
    console.log(`wheel event`);
  };

  useEffect(() => {
    document.addEventListener('wheel', handleMouseWheel, {
      passive: false
    });

    return () => document.removeEventListener('wheel', handleMouseWheel);
  }, []);
};
