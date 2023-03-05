import React, { FC } from 'react';
import { useShapes } from 'src/app/hooks';
import styles from './styles.css';

export const Stats: FC = () => {
  const shapes = useShapes();

  return <div className={styles.stats}>shape count: {Object.keys(shapes).length}</div>;
};
