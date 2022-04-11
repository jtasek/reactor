import { FC } from 'react';
import { Tool } from '../types';

import { CircleCommand } from './Circle';
import { EllipseCommand } from './Ellipse';
import { ImageCommand } from './Image';
import { LineCommand } from './Line';
import { PenCommand } from './Pen';
import { RectCommand } from './Rect';
import { SelectCommand } from './Select';
import { TextCommand } from './Text';

const library = [
  CircleCommand,
  EllipseCommand,
  ImageCommand,
  LineCommand,
  PenCommand,
  RectCommand,
  SelectCommand,
  TextCommand
];

export function getTool(toolId: string): Tool | undefined {
  const result = library.find((item) => item.id === toolId);

  return result;
}

export function getComponentByType(type: string): FC<any> | undefined {
  const result = library.find((item) => item.id === type);

  return result?.component;
}

export function useRegisteredTools(): Tool[] {
  return Object.values(library).map((item) => item);
}
