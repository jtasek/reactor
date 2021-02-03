import { FC } from 'react';
import { Tool } from '../types';

import Circle from './Circle';
import Ellipse from './Ellipse';
import Image from './Image';
import Line from './Line';
import Pen from './Pen';
import Rect from './Rect';
import Select from './Select';
import Text from './Text';

const library = [Circle, Ellipse, Image, Line, Pen, Rect, Select, Text];

export function getToolByType(type: string): Tool | undefined {
  const result = library.find((item) => item.code === type);

  return result;
}

export function getComponentByType(type: string): FC<any> | undefined {
  const result = library.find((item) => item.code === type);

  return result?.component;
}

export function useTools(): Tool[] {
  return Object.values(library).map((item) => item);
}
