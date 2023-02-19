import { useEffect } from 'react';
import { useActions } from 'src/app/hooks';

export const useKeyboard = () => {
  const { keyDown, keyUp } = useActions().events;

  const handleKeyDown = (event: KeyboardEvent) => {
    keyDown(event);
  };

  const handleKeyUp = (event: KeyboardEvent) => {
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
