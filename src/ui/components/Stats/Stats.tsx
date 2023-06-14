import React, { FC } from 'react';
import { useCamera, usePointer, useShapes } from 'src/app/hooks';
import styles from './styles.css';

const printObject = (value) => {
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, val]) => key + ': ' + printObject(val))
      .join(', ');
  }

  if (Array.isArray(value)) {
    return value.map((val) => printObject(val)).join(', ');
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    return Math.floor(value);
  }

  return value;
};

export const Stats: FC = () => {
  const shapes = useShapes();
  const camera = useCamera();
  const pointer = usePointer();

  return (
    <div className={styles.stats}>
      shape count: {Object.keys(shapes).length}
      <br />
      scale: {camera.scale}
      <br />
      bottomRightPosition: {printObject(pointer.bottomRightPosition)}
      <br />
      center: {printObject(pointer.center)}
      <br />
      dragging: {printObject(pointer.dragging)}
      <br />
      offset: {printObject(pointer.offset)}
      <br />
      path: {printObject(pointer.path.length)}
      <br />
      position: {printObject(pointer.position)}
      <br />
      radius: {printObject(pointer.radius)}
      <br />
      size: {printObject(pointer.size)}
      <br />
      startPosition: {printObject(pointer.startPosition)}
      <br />
      topLeftPosition: {printObject(pointer.topLeftPosition)}
      <br />
    </div>
  );
};
