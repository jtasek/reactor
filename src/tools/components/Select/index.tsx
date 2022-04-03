import React, { FC } from 'react';
import inlineStyles from './inlineStyles';
import type { Command, Point, Size } from 'src/app/types';
import type { Tool } from 'src/tools/types';
import { useAppState } from 'src/app/hooks';

/**
 * Selects highlighted shapes
 **/

interface Props {
  topLeftPosition: Point;
  size: Size;
}

export const Select: FC<Props> = ({ topLeftPosition, size }) => (
  <rect
    key="selection"
    style={inlineStyles}
    x={topLeftPosition.x}
    y={topLeftPosition.y}
    width={size.width}
    height={size.height}
    strokeDasharray="5, 5"
  />
);

export const SelectTool: FC = () => {
  const { pointer } = useAppState((state) => state.events);

  return <Select {...pointer} />;
};

export const SelectCommand: Tool = {
  id: 'select',
  name: 'Select',
  description: 'Select a shape or group',
  factory: (): Shape => {
    throw new Error('Factory not implemented');
  },
  tool: SelectTool,
  component: Select,
  icon: {
    group: 'action',
    name: 'pan_tool',
    // color: 'rgba(255,255,255)',
    size: 24
  },
  regex: /(?<toolCode>select)\((?<x1>[\d]+),(?<y1>[\d]+),(?<x2>[\d]+),(?<y2>[\d]+)\)/,
  shortcut: 's'
};
