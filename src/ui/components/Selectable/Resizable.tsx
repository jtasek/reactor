import React, { FC, useState } from 'react';
import { Box, ResizeHandlerType } from '../../../app/types';
import { Handle } from '../Handle';
import { Props } from './Selectable';
import { getBoundingBox } from '../../../app/utils';

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
    const [activeHandle, setActiveHandle] = useState<ResizeHandlerType>();

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

    const handlePointerDown = (handlerType?: ResizeHandlerType) => {
        console.log('handlePointerDown', handlerType);
        setActiveHandle(handlerType);
    };

    return (
        <>
            <Handle
                key={`topLeft + ${shape.id}`}
                active={activeHandle === 'topLeft'}
                position={topLeft}
                handlerType="topLeft"
                shapeId={shape.id}
                onActivate={handlePointerDown}
            />
            <Handle
                key={`middleTop + ${shape.id}`}
                active={activeHandle === 'middleTop'}
                position={middleTop}
                handlerType="middleTop"
                shapeId={shape.id}
                onActivate={handlePointerDown}
            />
            <Handle
                key="topRight"
                active={activeHandle === 'topRight'}
                position={topRight}
                handlerType="topRight"
                shapeId={shape.id}
                onActivate={handlePointerDown}
            />
            <Handle
                key={`middleRight + ${shape.id}`}
                active={activeHandle === 'middleRight'}
                position={middleRight}
                handlerType="middleRight"
                shapeId={shape.id}
                onActivate={handlePointerDown}
            />
            <Handle
                key={`bottomRight + ${shape.id}`}
                active={activeHandle === 'bottomRight'}
                position={bottomRight}
                handlerType="bottomRight"
                shapeId={shape.id}
                onActivate={handlePointerDown}
            />
            <Handle
                key={`middleBottom + ${shape.id}`}
                active={activeHandle === 'middleBottom'}
                position={middleBottom}
                handlerType="middleBottom"
                shapeId={shape.id}
                onActivate={handlePointerDown}
            />
            <Handle
                key={`bottomLeft + ${shape.id}`}
                active={activeHandle === 'bottomLeft'}
                position={bottomLeft}
                handlerType="bottomLeft"
                shapeId={shape.id}
                onActivate={handlePointerDown}
            />
            <Handle
                key={`middleLeft + ${shape.id}`}
                active={activeHandle === 'middleLeft'}
                position={middleLeft}
                handlerType="middleLeft"
                shapeId={shape.id}
                onActivate={handlePointerDown}
            />
        </>
    );
};
