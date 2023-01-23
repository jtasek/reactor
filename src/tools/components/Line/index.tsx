import React, { FC } from 'react';

import styles from '../../styles.css';
import type { Tool } from 'src/tools/types';
import { Command } from 'src/app/types';
import { Context } from 'src/app/hooks';

/**
 * Draws a line from the start point to the end point
 **/

interface Props {
  name: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  selected: boolean;
  type: string;
}

export const createLineProps = ({ state }: Context) => {
  const { startPosition, position } = state.events.pointer;

  return {
    name: 'Line x',
    x1: startPosition.x,
    y1: startPosition.y,
    x2: position.x,
    y2: position.y,
    selected: true,
    type: 'line'
  };
};

export const Line: FC<Props> = ({ name, x1, y1, x2, y2, selected }) => {
  const className = selected ? `${styles.shape} ${styles.selected}` : styles.shape;

  return <line key="line" data-name={name} className={className} x1={x1} y1={y1} x2={x2} y2={y2} />;
};

export const LineCommand: Command = {
  id: 'line',
  name: 'Line',
  category: 'shapes',
  description: 'Draw a line',
  regex: /(?<toolCode>line)\((?<x1>\d+),(?<y1>\d+),(?<x2>\d+),(?<y2>\d+)\)/,
  shortcut: 'ctrl+l',
  canExecute: (context, args?) => true,
  execute: (context, args?) => React.createElement(Line, createLineProps(context), null),
  factory: (context: Context) => createLineProps(context)
};

export const LineTool: Tool = {
  id: 'line',
  name: 'Line',
  description: 'Draw a line',
  command: LineCommand,
  component: Line,
  icon: {
    group: 'action',
    name: 'timeline',
    color: 'rgb(95, 216, 240)',
    size: 24
  }
};
