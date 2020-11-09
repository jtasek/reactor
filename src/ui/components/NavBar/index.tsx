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
      <NavBarList
        name="shapes"
        items={currentDocument.shapes}
        onClick={() => console.log('Not implemented')}
      />
      <NavBarList
        name="groups"
        items={currentDocument.groups}
        onClick={() => console.log('Not implemented')}
      />
      <NavBarList
        name="layers"
        items={currentDocument.layers}
        onClick={() => console.log('Not implemented')}
      />
      <NavBarList
        name="links"
        items={currentDocument.links}
        onClick={() => console.log('Not implemented')}
      />
      <NavBarList
        name="rulers"
        items={currentDocument.rulers}
        onClick={() => console.log('Not implemented')}
      />
    </NavBar>
  );
};
