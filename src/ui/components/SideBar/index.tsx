import React, { FC, ReactNode } from 'react';

import { SideBar } from './SideBar';
import { useControls } from 'src/app/hooks';

interface Props {
  children?: ReactNode;
}

export const SideBarContainer: FC<Props> = ({ children }) => {
  const { sideBar } = useControls();

  if (!sideBar.visible) {
    return null;
  }

  return <SideBar>{children}</SideBar>;
};
