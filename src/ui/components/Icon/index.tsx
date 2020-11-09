import React, { FC } from 'react';

export interface Props {
  color: string;
  group: string;
  name: string;
  size: number;
}

export const Icon: FC<Props> = ({ group, name, color, size }) => (
  <svg stroke={color} fill={color} height={size} width={size}>
    <use xlinkHref={`/icons/svg-sprite-${group}-symbol.svg#ic_${name}_24px`} fill="currentColor" />
  </svg>
);
