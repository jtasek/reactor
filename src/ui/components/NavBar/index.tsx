import React, { FC } from 'react';
import styles from './styles.css';
import { NavBar } from './NavBar';
import { NavBarList } from './NavBarList';
import { useActions, useCurrentDocument, useNavBar } from 'src/app/hooks';
import { selectGroup, selectLayer, selectLink, selectRuler, selectShape } from 'src/app/actions';

export const NavBarContainer: FC = () => {
  const document = useCurrentDocument();
  const { 
    selectGroup,
    selectLayer, 
    selectLink, 
    selectRuler, 
    selectShape, 
  } = useActions();
  const { visible } = useNavBar();

  if (!visible) {
    return null;
  }

  return (
    <NavBar>
      <NavBarList name="Shapes" items={Object.values(document.shapes)} onClick={selectShape} />
      <NavBarList name="Groups" items={Object.values(document.groups)} onClick={selectGroup} />
      <NavBarList name="Layers" items={Object.values(document.layers)} onClick={selectLayer} />
      <NavBarList name="Links" items={Object.values(document.links)} onClick={selectLink} />
      <NavBarList name="Rulers" items={Object.values(document.rulers)} onClick={selectRuler} />
    </NavBar>
  );
};
