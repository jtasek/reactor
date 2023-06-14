import React, { FC } from 'react';
import { useCurrentPage } from '../hooks';
import { useKeyboardDriver } from 'src/events/drivers/useKeyboardDriver';
import { usePreventNativePinchZoom } from './usePreventNativePinchZoom';
import { useTouchDriver } from 'src/events/drivers/useTouchDriver';

import { Designer, Documents } from '../../pages';

export const Shell: FC = () => {
  useKeyboardDriver();
  // useTouchDriver();
  usePreventNativePinchZoom();

  const currentPage = useCurrentPage();

  return (
    <>
      {currentPage === 'designer' && <Designer />}
      {currentPage === 'documents' && <Documents />}
    </>
  );
};
