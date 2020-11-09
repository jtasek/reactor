import React, { FC } from 'react';
import { Position } from '../../../app/types';

export interface Props {
  position: Position;
}

export const Cursor: FC<Props> = ({ position }) => (
  <div
    style={{
      color: 'black',
      position: 'absolute',
      left: `${position.x}px`,
      top: `${position.y}px`
    }}
  >
    x: {position.x}, y: {position.y}
  </div>
);
