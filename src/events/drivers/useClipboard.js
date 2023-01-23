import { useActions } from 'src/app/hooks';

export const useKeyboard = () => {
  const actions = useActions();

  const handleCopy = (event) => {};
  const handleCut = (event) => {};
  const handlePaste = (event) => {};

  return () => {
    handleCopy, handleCut, handlePaste;
  };
};
