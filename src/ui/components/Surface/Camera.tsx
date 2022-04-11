import React, { FC } from 'react';
import { useCamera } from 'src/app/hooks';

import styles from './styles.css';

export const Camera: FC = ({ children }) => {
  const { scale, position } = useCamera();

  return (
    <g
      className={styles.camera}
      transform={`translate(${position.x},${position.y}) scale(${scale})`}
    >
      {children}
    </g>
  );
};
