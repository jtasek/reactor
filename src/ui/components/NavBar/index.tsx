import React, { FC } from 'react';
import styles from './styles.css';
import { NavBar } from './NavBar';
import { NavBarList } from './NavBarList';
import { useState } from 'src/app/hooks';

export const NavBarContainer: FC = () => {
  const { currentDocument, ui } = useState();

  if (!ui.navBar.visible) {
    return null;
  }

  return (
    <NavBar>
      {currentDocument.shapes.length}
      <NavBarList
        name="shapes"
        items={Object.values(currentDocument.shapes)}
        onClick={() => console.log('Not implemented')}
      />
      <NavBarList
        name="groups"
        items={Object.values(currentDocument.groups)}
        onClick={() => console.log('Not implemented')}
      />
      <NavBarList
        name="layers"
        items={Object.values(currentDocument.layers)}
        onClick={() => console.log('Not implemented')}
      />
      <NavBarList
        name="links"
        items={Object.values(currentDocument.links)}
        onClick={() => console.log('Not implemented')}
      />
      <NavBarList
        name="rulers"
        items={Object.values(currentDocument.rulers)}
        onClick={() => console.log('Not implemented')}
      />
    </NavBar>
  );
};
