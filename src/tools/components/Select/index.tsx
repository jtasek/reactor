import React, { FC } from 'react';
import { Point, Size } from 'src/app/types';
import { useState } from 'src/app/hooks';
import inlineStyles from './inlineStyles';

/**
 * Selects highlighted shapes
 **/

interface Props {
  position: Point;
  size: Size;
}

export const Select: FC<Props> = ({ position, size }) => (
  <rect
    key="selection"
    style={inlineStyles}
    x={position.x}
    y={position.y}
    width={size.width}
    height={size.height}
    strokeDasharray="5, 5"
  />
);

export const DesignSelect: FC = () => {
  const { pointer } = useState().events;

  return <Select {...pointer} />;
};
