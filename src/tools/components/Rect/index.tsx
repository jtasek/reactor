import React, { FC, useRef } from 'react';

import styles from '../../styles.css';
import type { Command, Position, Size } from 'src/app/types';
import type { Tool } from 'src/tools/types';
import { Context } from 'src/app/hooks';

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
  code: string;
  name: string;
  position: Position;
  size: Size;
  selected: boolean;
  type: 'rect';
}

export function createRectProps({ state }: Context, designMode = false) {
  const { topLeftPosition, scaledTopLeftPosition, size, scaledSize } = state.events.pointer;

  return {
    code: 'rect-x',
    name: 'Rectangle x',
    position: designMode ? scaledTopLeftPosition : topLeftPosition,
    selected: true,
    size: designMode ? scaledSize : size,
    type: 'rect'
  };
}

export const Rect: FC<Props> = ({ name, type, position, size, selected }) => {
  const shape = useRef(null);
  const className = selected ? `${styles.shape} ${styles.selected}` : styles.shape;

  return (
    <rect
      data-cy={name}
      ref={shape}
      fill="none"
      className={className}
      x={position?.x}
      y={position?.y}
      width={size?.width}
      height={size?.height}
      onClick={() => {
        //console.log('rect bbox', shape.current?.getBBox());
      }}
    />
  );
};

export const RectCommand: Command = {
  id: 'rect',
  name: 'Rectangle',
  category: 'shapes',
  description: 'Draw a rectangle or square',
  regex: /(?<toolCode>rect)\((?<x1>[\d]+),(?<y1>[\d]+),(?<x2>[\d]+),(?<y2>[\d]+)\)/,
  shortcut: 'r',
  canExecute: (context, args) => true,
  execute: (context, args) => React.createElement(Rect, createRectProps(context) as Props, null),
  factory: (context: Context) => createRectProps(context, true)
};

export const RectTool: Tool = {
  id: 'rect',
  name: 'Rectangle',
  description: 'Draw a rectangle or square',
  command: RectCommand,
  component: Rect,
  icon: {
    group: 'image',
    name: 'crop_square',
    color: 'rgba(255,255,255)',
    size: 24
  }
};
