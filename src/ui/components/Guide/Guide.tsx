import React, { FC } from 'react';
import { Point, Guide as GuideType } from 'src/app/types';

export interface Props {
    guide: GuideType;
    position: Point;
    scale: number;
}

export const Guide: FC<Props> = ({ guide, position, scale }) => (
    <line
        x1={guide.orientation === 'horizontal' ? 0 : guide.position.x * scale + position.x}
        y1={guide.orientation === 'horizontal' ? guide.position.y * scale + position.y : 0}
        x2={guide.orientation === 'horizontal' ? '100%' : guide.position.x * scale + position.x}
        y2={guide.orientation === 'horizontal' ? guide.position.y * scale + position.y : '100%'}
        strokeWidth="1"
        stroke="purple"
    />
);
