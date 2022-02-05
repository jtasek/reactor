import React, { FC } from 'react';
import { useState } from './hooks';
import { useKeyboard } from 'src/events/drivers/keyboard';

import { Designer, Documents } from '../pages';

export const Shell: FC = () => {
  useKeyboard();
  const { currentPage } = useState();

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
