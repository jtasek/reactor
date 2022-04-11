import React, { FC, useEffect, useState } from 'react';

import styles from './styles.css';
import type { Position } from '../../../app/types';
import { useActions, usePointer } from 'src/app/hooks';

export interface Props {
  shapeId: string;
  position: Position;
  size?: number;
  type:
    | 'bottomLeft'
    | 'bottomRight'
    | 'middleBottom'
    | 'middleLeft'
    | 'middleRight'
    | 'middleTop'
    | 'topLeft'
    | 'topRight';
}

export const Handle: FC<Props> = ({ shapeId, position, type, size = 5 }) => {
  const { resizeShape } = useActions();
  const pointer = usePointer();
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (active) {
      resizeShape({ shapeId, type, pointer });
    }
  }, [pointer.position]);

  const handleMouseDown = (e) => {
    setActive(true);
  };

  const handleMouseUp = (e) => {
    setActive(false);
  };

  const classes = [styles.handle, styles[type]];

  return (
    <circle
      className={classes.join(' ')}
      cx={position.x}
      cy={position.y}
      r={size}
      data-type={type}
      fill={active ? 'red' : 'blue'}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    />
  );
};
