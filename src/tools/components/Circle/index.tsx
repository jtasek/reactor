import React, { FC, useRef } from 'react';

import styles from '../../styles.css';
import type { Tool } from 'src/tools/types';
import { Command } from 'src/app/types';
import { Context } from 'src/app/hooks';

/**
 * Draws a circle based on input centre point and radius

<circle 
    cx="the x-axis center of the circle" 
    cy="the y-axis center of the circle" 
    r="The circle's radius. Required." 
/>
**/

interface Props {
  code: string;
  name: string;
  cx: number;
  cy: number;
  r: number;
  selected: boolean;
  type: string;
}

export const createCircleProps = ({ state }: Context, designMode = false) => {
  const { centre, scaledCentre, radius, scaledRadius } = state.events.pointer;

  return {
    code: 'circle-x',
    cx: designMode ? scaledCentre.x : centre.x,
    cy: designMode ? scaledCentre.y : centre.y,
    r: designMode ? scaledRadius : radius,
    name: 'Circle x',
    selected: true,
    type: 'circle'
  };
};

export const Circle: FC<Props> = ({ code, cx, cy, r, selected }) => {
  // const shape = useRef();
  const className = selected ? `${styles.shape} ${styles.selected}` : styles.shape;

  return (
    <circle
      //   ref={shape}
      key="circle"
      fill="none"
      stroke="grey"
      strokeWidth={2}
      data-cy={code}
      data-name={name}
      className={className}
      onClick={() => {
        // console.log('circle bbox', shape.current.getBBox());
        //  console.log(`x: ${shape.current?.x}, y: ${shape.current?.y}`);
      }}
      cx={cx}
      cy={cy}
      r={r}
    />
  );
};

export const CircleCommand: Command = {
  id: 'circle',
  name: 'Circle',
  category: 'shapes',
  description: 'Draws a circle shape',
  icon: {
    group: 'image',
    name: 'panorama_fish_eye',
    color: 'rgb(144, 254, 214)',
    size: 24
  },
  regex: /(?<toolCode>circle)\((?<cx>\d+),(?<cy>\d+),(?<radius>\d+)\)/,
  shortcut: 'ctrl+c',
  canExecute: (context, args?) => true,
  execute: (context: Context, args?) =>
    React.createElement(Circle, createCircleProps(context), null),
  factory: (context: Context) => createCircleProps(context, true)
};

// Tool is visual command that is used to draw a shape
export const CircleTool: Tool = {
  id: 'circle',
  name: 'Circle',
  description: 'Draw a circle',
  command: CircleCommand,
  component: Circle
};
