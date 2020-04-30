import React, { FC } from 'react';

import { Size } from '../../../app/types';

interface Props {
  text: string;
  color: string;
  size: Size;
}

export const Badge: FC<Props> = ({ text, color, size }) => (
  <span
    style={{
      borderRadius: '50%',
      color: color,
      height: size.height,
      position: 'absolute',
      right: 0,
      top: 0,
      width: size.width
    }}
  >
    {text}
  </span>
);
