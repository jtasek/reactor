import React, { FC } from 'react';

import styles from '../../styles.css';
import type { Command, Point } from 'src/app/types';
import type { Tool } from 'src/tools/types';
import { Context } from 'src/app/hooks';
import { stringifyPath } from 'src/app/utils';

/** 
 * Draws a line based on path
 
 <polyline points="the points on the polyline. Required." />
  
**/

interface Props {
  key: string;
  name: string;
  points: Point[];
  selected: true;
  type: string;
}

export function createPenProps({ state }: Context, designMode = false) {
  const { path, scaledPath } = state.events.pointer;

  return {
    key: 'pen-x',
    name: 'Pen x',
    points: designMode ? scaledPath : path,
    selected: true,
    type: 'pen'
  };
}

export const Pen: FC<Props> = ({ name, points, selected }) => {
  const className = selected ? `${styles.shape} ${styles.selected}` : styles.shape;

  return (
    <polyline key="pen" data-name={name} className={className} points={stringifyPath(points)} />
  );
};

export const PenCommand: Command = {
  id: 'pen',
  name: 'Pen',
  category: 'shapes',
  description: 'Draws a line',
  icon: {
    group: 'content',
    name: 'create',
    color: 'rgba(255,255,255)',
    size: 24
  },
  regex: /(?<toolCode>pen)\((?<path>[\d, ]+)\)/,
  shortcut: 'ctrl+p',
  canExecute: (context, args?) => true,
  execute: (context, args?) => React.createElement(Pen, createPenProps(context) as Props, null),
  factory: (context: Context) => createPenProps(context, true)
};

export const PenTool: Tool = {
  id: 'pen',
  name: 'Pen',
  description: 'Draw a curve line',
  command: PenCommand,
  component: Pen
};
