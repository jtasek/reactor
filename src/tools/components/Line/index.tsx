import React, { FC } from 'react';
import styles from '../../styles.css';
import { useAppState, useEvents } from 'src/app/hooks';
import type { Pointer } from 'src/events/types';
import type { Tool } from 'src/tools/types';

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

export function createLine({ startPosition, position }: Pointer): Props {
  return {
    name: 'Line x',
    x1: startPosition.x,
    y1: startPosition.y,
    x2: position.x,
    y2: position.y,
    selected: true,
    type: 'line'
  };
}

export const Line: FC<Props> = ({ x1, y1, x2, y2, selected }) => {
  const className = selected ? `${styles.shape} ${styles.selected}` : styles.shape;

  return <line key="line" className={className} x1={x1} y1={y1} x2={x2} y2={y2} />;
};

export const LineTool: FC = () => {
  const { pointer } = useEvents();

  return <Line {...createLine(pointer)} />;
};

export const LineCommand: Tool = {
  id: 'line',
  name: 'Line',
  description: 'Draw a line',
  factory: createLine,
  tool: LineTool,
  component: Line,
  icon: {
    group: 'action',
    name: 'timeline',
    // color: 'rgb(95, 216, 240)',
    size: 24
  },
  regex: /(?<toolCode>line)\((?<x1>\d+),(?<y1>\d+),(?<x2>\d+),(?<y2>\d+)\)/,
  shortcut: 'ctrl+l'
};
