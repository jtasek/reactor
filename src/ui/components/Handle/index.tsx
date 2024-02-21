import React, { FC, useEffect, useState } from 'react';

import styles from './styles.css';
import { Position, ResizeHandlerType } from '../../../app/types';
import { useActions, usePointer } from 'src/app/hooks';

export interface Props {
  shapeId: string;
  position: Position;
  size?: number;
  type: ResizeHandlerType;
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

  const handleMouseDown = () => {
    setActive(true);
  };

  const handleMouseUp = () => {
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
