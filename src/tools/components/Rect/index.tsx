import React, { FC } from 'react';
import { Size } from 'src/app/types';
import { Pointer } from 'src/events/types';
import { useState } from 'src/app/hooks';

/**
 * Draws a rectange based on position and size
 
 <rect 
    x="the x-axis top-left corner of the rectangle"
    y="the y-axis top-left corner of the rectangle"
    rx="the x-axis radius (to round the element)"
    ry="the y-axis radius (to round the element)" 
    width="the width of the rectangle. Required."
    height="the height of the rectangle Required." 
/>
**/

interface Props {
  name: string;
  position: Position;
  radius: number;
  size: Size;
  selected: boolean;
  type: 'rect';
}

export function createRect({ position, size, radius }): Props {
  return {
    name: 'Rectangle x',
    position,
    radius,
    size,
    selected: true,
    type: 'rect'
  };
}

export const Rect: FC<Partial<Pointer>> = ({ position, size, radius }) => {
  //const className = shape.selected ? `${styles.shape} ${styles.selected}` : styles.shape;

  return (
    <rect
      //className={className}
      x={position?.x}
      y={position?.y}
      width={size?.width}
      height={size?.height}
      rx={radius}
      ry={radius}
    />
  );
};

export const DesignRect: FC = () => {
  const { pointer } = useState().events;

  return <Rect key="rect-design" {...pointer} />;
};
