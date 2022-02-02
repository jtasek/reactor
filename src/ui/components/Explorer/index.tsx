import React, { FC } from 'react';
import styles from './styles.css';

import { Explorer } from './Explorer';
import { useExplorer } from 'src/app/hooks';

export const ConnectedExplorer: FC = ({ children }) => {
  const { visible } = useExplorer();

  if (!visible) {
    return null;
  }

  return <Explorer>{children}</Explorer>;
};

