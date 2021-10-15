import { useEffect } from 'react';
import { useActions } from 'src/app/hooks';

export const useKeyboard = () => {
  const actions = useActions();
  useEffect(() => {
    const listener = window.addEventListener('keydown', (event) => {
      actions.events.keyPressed(event);
    });

    return () => window.removeEventListener(listener);
  }, []);
};
