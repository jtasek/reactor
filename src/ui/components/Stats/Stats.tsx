import React, { FC } from 'react';
import { useCamera, useShapes } from 'src/app/hooks';
import styles from './styles.css';

export const Stats: FC = () => {
  const shapes = useShapes();
  const camera = useCamera();

  return (
    <div className={styles.stats}>
      shape count: {Object.keys(shapes).length}
      <br />
      scale: {camera.scale}
      <br />
    </div>
  );
};
