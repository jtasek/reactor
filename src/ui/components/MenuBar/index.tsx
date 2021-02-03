import React, { FC } from 'react';
import { useState } from 'src/app/hooks';
import { MenuBar } from './MenuBar';

import styles from './styles.css';

export const MenuBarContainer: FC = () => {
  const { visible } = useState().ui.menuBar;

  if (!visible) {
    return null;
  }

  return (
    <MenuBar
      actions={[
        { label: 'Documents', url: 'documents' },
        { label: 'About', url: 'about' },
        { label: 'Profile', url: 'profile' }
      ]}
    />
  );
};
