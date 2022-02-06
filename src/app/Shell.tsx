import React, { FC } from 'react';
import { useAppState } from './hooks';
import { useKeyboard } from 'src/events/drivers/keyboard';

import { Designer, Documents } from '../pages';

export const Shell: FC = () => {
  useKeyboard();
  const { currentPage } = useAppState();

  return (
    <>
      <nav>
        <a href="/">Designer</a>
        <a href="documents">Documents</a>
      </nav>
      {currentPage === 'designer' && <Designer />}
      {currentPage === 'documents' && <Documents />}
    </>
  );
};
