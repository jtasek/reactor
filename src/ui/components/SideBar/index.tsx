import React, { FC } from 'react';

import { SideBar } from './SideBar';
import { useState } from 'src/app/hooks';

export const SideBarContainer: FC = ({ children }) => {
  const { ui } = useState();

  if (!ui.sideBar.visible) {
    return null;
  }

  return <SideBar>{children}</SideBar>;
};
