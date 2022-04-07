import { useEffect } from 'react';
import { useActions } from 'src/app/hooks';

export const useKeyboard = () => {
  const actions = useActions();
  useEffect(() => {
    const keyDownListener = window.addEventListener('keydown', actions.events.keyDown);
    const keyupListener = window.addEventListener('keyup', actions.events.keyUp);

    return () => {
      window.removeEventListener(keyDownListener);
      window.removeEventListener(keyupListener);
    };
  }, []);
};
