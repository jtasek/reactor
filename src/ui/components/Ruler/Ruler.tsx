import React, { FC } from 'react';
import { Orientation, Point, Ruler as RulerType } from 'src/app/types';

export interface Props {
    ruler: RulerType;
    position: Point;
    scale: number;
}

export const Ruler: FC<Props> = ({ ruler, position, scale }) => (
    <line
        x1={
            ruler.orientation === Orientation.Horizontal ? 0 : ruler.position.x * scale + position.x
        }
        y1={
            ruler.orientation === Orientation.Horizontal ? ruler.position.y * scale + position.y : 0
        }
        x2={
            ruler.orientation === Orientation.Horizontal
                ? '100%'
                : ruler.position.x * scale + position.x
        }
        y2={
            ruler.orientation === Orientation.Horizontal
                ? ruler.position.y * scale + position.y
                : '100%'
        }
        strokeWidth="1"
        stroke="purple"
    />
);
