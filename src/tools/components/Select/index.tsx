import React, { FC } from 'react';
import inlineStyles from './inlineStyles';
import type { Point, Size } from 'src/app/types';
import type { Tool } from 'src/tools/types';
import { Command } from 'src/app/types';
import { isPointInBox } from 'src/app/utils';
import { log } from 'console';
import { Context } from '../../../app';

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

export function createSelectProps({ state }: Context, designMode = false) {
  const { topLeftPosition, scaledTopLeftPosition, size, scaledSize } = state.events.pointer;

  return {
    key: 'selection',
    name: 'selection',
    position: designMode ? scaledTopLeftPosition : topLeftPosition,
    size: designMode ? scaledSize : size,
    type: 'select'
  };
}

export const selectShape = ({ state }: Context) => {
  const { events, currentDocument } = state;
  Object.values(currentDocument.shapes).forEach((shape) =>
    isPointInBox(events.pointer.position, shape)
  );
};

export const SelectCommand: Command = {
  id: 'select',
  name: 'Select',
  category: 'shapes',
  description: 'Selects shapes and groups ',
  icon: {
    group: 'action',
    name: 'pan_tool',
    color: 'rgba(255,255,255)',
    size: 24
  },
  regex: /(?<toolCode>select)\((?<x1>[\d]+),(?<y1>[\d]+),(?<x2>[\d]+),(?<y2>[\d]+)\)/,
  shortcut: 's',
  canExecute: (context: Context) => true,
  execute: (context, args) => {
    console.log('select executer');
    React.createElement(Select, createSelectProps(context) as Props, null);
  },
  factory: (context: Context) => createSelectProps(context, true)
};

export const SelectTool: Tool = {
  id: 'select',
  name: 'Select',
  description: 'Select a shape or group',
  command: SelectCommand,
  component: Select
};
