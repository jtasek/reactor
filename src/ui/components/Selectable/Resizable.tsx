import React, { FC } from 'react';
import { getBoundingBox } from '../../../app/utils';
import { Handle } from '../Handle';
import { Box } from '../../../app/types';
import { Props } from './Selectable';

function calcBoundingPoints(box: Box) {
    const topLeft = box.topLeft;
    const topRight = { x: box.bottomRight.x, y: box.topLeft.y };
    const bottomLeft = { x: box.topLeft.x, y: box.bottomRight.y };
    const bottomRight = box.bottomRight;
    const height = bottomLeft.y - topLeft.y;
    const width = bottomRight.x - topLeft.x;

    const middleLeft = { x: topLeft.x, y: topLeft.y + height / 2 };
    const middleRight = { x: bottomRight.x, y: topRight.y + height / 2 };
    const middleTop = { x: topLeft.x + width / 2, y: topLeft.y };
    const middleBottom = { x: bottomLeft.x + width / 2, y: bottomRight.y };

    return {
        topLeft,
        topRight,
        bottomLeft,
        bottomRight,
        middleLeft,
        middleRight,
        middleTop,
        middleBottom
    };
}

export const Resizable: FC<Props> = ({ shape }) => {
    if (!shape.selected) {
        return null;
    }

    const box = getBoundingBox(shape);

    if (!box?.topLeft || !box?.bottomRight) {
        return null;
    }

    const {
        topLeft,
        topRight,
        bottomLeft,
        bottomRight,
        middleLeft,
        middleRight,
        middleTop,
        middleBottom
    } = calcBoundingPoints(box);

    return (
        <>
            <Handle key="topLeft" position={topLeft} handlerType="topLeft" shapeId={shape.id} />
            <Handle
                key="middleTop"
                position={middleTop}
                handlerType="middleTop"
                shapeId={shape.id}
            />
            <Handle key="topRight" position={topRight} handlerType="topRight" shapeId={shape.id} />
            <Handle
                key="middleRight"
                position={middleRight}
                handlerType="middleRight"
                shapeId={shape.id}
            />
            <Handle
                key="bottomRight"
                position={bottomRight}
                handlerType="bottomRight"
                shapeId={shape.id}
            />
            <Handle
                key="middleBottom"
                position={middleBottom}
                handlerType="middleBottom"
                shapeId={shape.id}
            />
            <Handle
                key="bottomLeft"
                position={bottomLeft}
                handlerType="bottomLeft"
                shapeId={shape.id}
            />
            <Handle
                key="middleLeft"
                position={middleLeft}
                handlerType="middleLeft"
                shapeId={shape.id}
            />
        </>
    );
};
