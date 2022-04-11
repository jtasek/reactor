import React, { FC } from 'react';

import styles from './styles.css';
import { NavBar } from './NavBar';
import { ComponentsList } from './ComponentsList';
import { GroupsList } from './GroupsList';
import { LayersList } from './LayersList';
import { LinksList } from './LinksList';
import { RulersList } from './RulersList';
import { ShapesList } from './ShapesList';
import { useControls } from 'src/app/hooks';

export const NavBarContainer: FC = () => {
  const { navBar } = useControls();

  if (!navBar.visible) {
    return null;
  }

  return (
    <NavBar>
      <ComponentsList />
      <ShapesList />
      <GroupsList />
      <LayersList />
      <LinksList />
      <RulersList />
    </NavBar>
  );
};
