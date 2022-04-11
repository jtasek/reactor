import React, { FC } from 'react';
import type { Position, Size } from 'src/app/types';
import type { Pointer } from 'src/events/types';
import { usePointer } from 'src/app/hooks';
import type { Tool } from 'src/tools/types';
import styles from '../../styles.css';
import { toggleShapeSelected } from 'src/app/actions';

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
  size: Size;
  selected: boolean;
  type: 'rect';
}

export function createRect({ topLeftPosition, size }: Pointer): Props {
  return {
    name: 'Rectangle x',
    position: topLeftPosition,
    selected: true,
    size,
    type: 'rect'
  };
}

export const Rect: FC<Props> = ({ position, size, selected }) => {
  const className = selected ? `${styles.shape} ${styles.selected}` : styles.shape;

  return (
    <rect
      fill="none"
      className={className}
      x={position?.x}
      y={position?.y}
      width={size?.width}
      height={size?.height}
    />
  );
};

export const RectTool: FC = () => {
  const pointer = usePointer();

  return <Rect {...createRect(pointer)} />;
};

export const RectCommand: Tool = {
  id: 'rect',
  name: 'Rectangle',
  description: 'Draw a rectangle or square',
  factory: createRect,
  tool: RectTool,
  component: Rect,
  icon: {
    group: 'image',
    name: 'crop_square',
    color: 'rgba(255,255,255)',
    size: 24
  },
  regex: /(?<toolCode>rect)\((?<x1>[\d]+),(?<y1>[\d]+),(?<x2>[\d]+),(?<y2>[\d]+)\)/,
  shortcut: 'r'
};
