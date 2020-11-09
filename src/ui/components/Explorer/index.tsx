import React, { FC } from 'react';
import styles from './styles.css';
import { useState } from 'src/app/hooks';
import { Explorer } from './Explorer';

export const ConnectedExplorer: FC = ({ children }) => {
  const { visible } = useState().ui.explorer;

  if (!visible) {
    return null;
  }

  return <Explorer>{children}</Explorer>;
};
