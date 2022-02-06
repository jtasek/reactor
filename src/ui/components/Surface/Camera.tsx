import React, { FC } from 'react';
import { useAppState } from 'src/app/hooks';

import styles from './styles.css';

export const Camera: FC = ({ children }) => {
  const { currentDocument } = useAppState();

  const { scale, position } = currentDocument.camera;

  return (
    <g
      className={styles.camera}
      transform={`translate(${position.x},${position.y}) scale(${scale})`}
    >
      {children}
    </g>
  );
};
