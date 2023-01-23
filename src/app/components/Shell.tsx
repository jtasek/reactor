import React, { FC } from 'react';
import { useAppState } from '../hooks';
import { useKeyboard } from 'src/events/drivers/useKeyboard';

import { Designer, Documents } from '../../pages';

export const Shell: FC = () => {
  useKeyboard();
  const currentPage = useAppState((state) => state.currentPage);

  return (
    <>
      {currentPage === 'designer' && <Designer />}
      {currentPage === 'documents' && <Documents />}
    </>
  );
};
