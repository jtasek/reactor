import React, { FC, useRef } from 'react';

import styles from '../../styles.css';
import type { Command, Position, Size } from 'src/app/types';
import type { Tool } from 'src/tools/types';
import { usePointer } from 'src/app/hooks';
import { Pointer } from 'src/events/types';
import { newShapeName } from 'src/app/factories';
import { Context } from '../../../app';

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
  key: string;
  name: string;
  position: Position;
  size: Size;
  selected: boolean;
  type?: 'rect';
}

export const createRectProps = (
  { topLeftPosition, scaledTopLeftPosition, size, scaledSize }: Pointer,
  designMode = false
) => {
  const name = designMode ? 'Rectangle x' : newShapeName();
  const key = name.toLowerCase();

  console.log(
    `scaledTopLeftPosition: [${scaledTopLeftPosition.x},${scaledTopLeftPosition.y}], topLeftPosition: [${topLeftPosition.x}, ${topLeftPosition.y}]`
  );

  return {
    key,
    name,
    position: designMode ? scaledTopLeftPosition : topLeftPosition,
    selected: true,
    size: designMode ? scaledSize : size,
    type: 'rect'
  };
};

export const Rect: FC<Props> = ({ name, position, size, selected }) => {
  const shape = useRef(null);
  const className = selected ? `${styles.shape} ${styles.selected}` : styles.shape;
  console.log('rendering Rect');

  return (
    <rect
      className={className}
      //data-cy={code}
      data-name={name}
      fill="none"
      height={size?.height}
      ref={shape}
      width={size?.width}
      x={position?.x}
      y={position?.y}
      onClick={() => {
        // console.log('rect native bbox', shape.current?.getBBox());
        // console.log('rect', { position, size });
      }}
    />
  );
};

export const DesignRect: FC<Props> = () => {
  const pointer = usePointer();

  const { key, name, position, size } = createRectProps(pointer, true);

  return <Rect key={key} name={name} position={position} size={size} selected />;
};

export const RectCommand: Command = {
  id: 'rect',
  name: 'Rectangle',
  category: 'shapes',
  description: 'Draws a rectangle or square',
  icon: {
    group: 'image',
    name: 'crop_square',
    color: 'rgba(255,255,255)',
    size: 24
  },
  regex: /(?<toolCode>rect)\((?<x1>[\d]+),(?<y1>[\d]+),(?<x2>[\d]+),(?<y2>[\d]+)\)/,
  shortcut: 'r',
  canExecute: (context) => true,
  execute: ({ state }: Context, args) =>
    React.createElement(Rect, createRectProps(state.events.pointer, false), null),
  factory: ({ state }: Context) => createRectProps(state.events.pointer, true)
};

export const RectTool: Tool = {
  id: 'rect',
  name: 'Rectangle',
  description: 'Draw a rectangle or square',
  command: RectCommand,
  component: Rect
};
