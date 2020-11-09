import React, { FC } from 'react';
import { Orientation, Ruler as RulerType } from 'src/app/types';

export interface Props {
  ruler: RulerType;
  scale: number;
}

export const Ruler: FC<Props> = ({ ruler, scale }) => (
  <line
    x1={ruler.orientation === Orientation.Horizontal ? 0 : ruler.position.x * scale}
    y1={ruler.orientation === Orientation.Horizontal ? ruler.position.y * scale : 0}
    x2={ruler.orientation === Orientation.Horizontal ? '100%' : ruler.position.x * scale}
    y2={ruler.orientation === Orientation.Horizontal ? ruler.position.y * scale : '100%'}
    strokeWidth="1"
    stroke="red"
  />
);
