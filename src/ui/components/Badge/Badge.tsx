import React, { FC } from 'react';

export interface Props {
  text: string;
  color: string;
  size: number;
}

export const Badge: FC<Props> = ({ text, color, size }) => (
  <span
    style={{
      backgroundColor: color,
      borderRadius: `${size}px`,
      color: 'white',
      display: 'inline-block',
      fontSize: 'large',
      fontWeight: 700,
      height: `${size}px`,
      left: 0,
      minHeight: `${size}px`,
      minWidth: `${size}px`,
      position: 'relative',
      textAlign: 'center',
      top: 0,
      verticalAlign: 'middle',
      whiteSpace: 'nowrap',
      width: `${size}px`
    }}
  >
    {text}
  </span>
);
