import React, { FC } from 'react';

import styles from './styles.css';

import { Explorer } from './Explorer';
import { useControls } from 'src/app/hooks';

export const ConnectedExplorer: FC = ({ children }) => {
  const { explorer } = useControls();

  if (!explorer.visible) {
    return null;
  }

  return <Explorer>{children}</Explorer>;
};
