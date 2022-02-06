import React, { FC } from 'react';

import { SideBar } from './SideBar';
import { useAppState } from 'src/app/hooks';

export const SideBarContainer: FC = ({ children }) => {
  const { ui } = useAppState();

  if (!ui.sideBar.visible) {
    return null;
  }

  return <SideBar>{children}</SideBar>;
};
