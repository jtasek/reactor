import React, { FC } from 'react';

import { SideBar } from './SideBar';
import { useControls } from 'src/app/hooks';

export const SideBarContainer: FC = ({ children }) => {
  const { sideBar } = useControls();

  if (!sideBar.visible) {
    return null;
  }

  return <SideBar>{children}</SideBar>;
};
