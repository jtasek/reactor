import React, { FC } from 'react';
import inlineStyles from './inlineStyles';
import type { Point, Size } from 'src/app/types';
import type { Tool } from 'src/tools/types';
import { usePointer } from 'src/app/hooks';
import { SelectCommand } from 'src/commands/select';

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

export const SelectTool: Tool = {
  id: 'select',
  name: 'Select',
  description: 'Select a shape or group',
  command: SelectCommand,
  component: Select
};
