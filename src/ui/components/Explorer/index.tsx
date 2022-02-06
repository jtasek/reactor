import React, { FC} from 'react';
import styles from './styles.css';

import { Explorer } from './Explorer';
import { useAppState } from 'src/app/hooks';

export const ConnectedExplorer: FC = ({ children }) => {
  const { visible } = useAppState((state) => state.ui.explorer);

  if (!visible) {
    return null;
  }

  return <Explorer>{children}</Explorer>;
};
