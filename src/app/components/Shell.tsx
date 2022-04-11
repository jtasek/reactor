import React, { FC } from 'react';
import { useAppState } from '../hooks';
import { useKeyboardDriver } from 'src/events/drivers/keyboardDriver';

import { Designer, Documents } from '../../pages';

export const Shell: FC = () => {
  useKeyboardDriver();
  const currentPage = useAppState((state) => state.currentPage);

  return (
    <>
      {currentPage === 'designer' && <Designer />}
      {currentPage === 'documents' && <Documents />}
    </>
  );
};
