import React, { FC } from 'react';

import styles from '../../styles.css';
import type { Tool } from 'src/tools/types';
import { Command } from 'src/app/types';
import { Context } from 'src/app/hooks';

/**
 * Draws an ellipse based on input coords and size

<ellipse 
    cx="the x-axis center of the ellipse"
    cy="the y-axis center of the ellipse"
    rx="the length of the ellipse's radius along the x-axis. Required."
    ry="the length of the ellipse's radius along the y-axis. Required." 
/>
**/

interface Props {
  code: string;
  name: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  selected: boolean;
  type: string;
}

export const createEllipseProps = ({ state }: Context, designMode = false) => {
  const { centre, scaledCentre, size, scaledSize } = state.events.pointer;

  return {
    code: 'ellipse-x',
    cx: designMode ? scaledCentre.x : centre.x,
    cy: designMode ? scaledCentre.y : centre.y,
    name: 'Ellipse x',
    rx: designMode ? scaledSize.width : size.width,
    ry: designMode ? scaledSize.height : size.height,
    selected: true,
    type: 'ellipse'
  };
};

export const Ellipse: FC<Props> = ({ name, cx, cy, rx, ry, selected }) => {
  const className = selected ? `${styles.shape} ${styles.selected}` : styles.shape;

  return (
    <ellipse key="ellipse" data-cy={name} className={className} cx={cx} cy={cy} rx={rx} ry={ry} />
  );
};

export const EllipseCommand: Command = {
  id: 'ellipse',
  name: 'Ellipse',
  category: 'shapes',
  description: 'Draws and elliptic shape',
  icon: {
    group: 'image',
    name: 'panorama_fish_eye',
    color: 'rgb(144, 254, 214)',
    size: 24
  },
  regex: /(?<toolCode>ellipse)\((?<cx>\d+),(?<cy>\d+),(?<rx>\d+),(?<ry>\d+)\)/,
  shortcut: 'ctrl+e',
  canExecute: (context, args?) => true,
  execute: (context, args) => React.createElement(Ellipse, createEllipseProps(context), null),
  factory: (context: Context) => createEllipseProps(context, true)
};

export const EllipseTool: Tool = {
  id: 'ellipse',
  name: 'Ellipse',
  description: 'Draw an ellipse',
  command: EllipseCommand,
  component: Ellipse
};
