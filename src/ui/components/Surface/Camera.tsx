import React, { FC, ReactNode } from 'react';
import { useCamera } from 'src/app/hooks';

import styles from './styles.css';

interface Props {
  children?: ReactNode;
}

export const Camera: FC<Props> = ({ children }) => {
  const { position, scale } = useCamera();

  return (
    <g
      className={styles.camera}
      transform={`translate(${position.x},${position.y}) scale(${scale})`}
    >
      {children}
    </g>
  );
};
