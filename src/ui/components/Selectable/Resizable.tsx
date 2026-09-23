import React, { FC } from 'react';
import { Box } from '../../../app/types';
import { Handle } from '../Handle';
import { RotateHandle } from '../Handle/RotateHandle';
import handleStyles from '../Handle/styles.css';
import { Props } from './Selectable';
import { getShapeBounds } from '../../../app/utils';
import { usePointer } from 'src/app/hooks';

const ROTATE_HANDLE_OFFSET = 24;

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
    const { gesture } = usePointer();
    const activeHandle =
        gesture.kind === 'resizing' && gesture.shapeId === shape.id ? gesture.handle : undefined;
    const rotateActive = gesture.kind === 'rotating' && gesture.shapeId === shape.id;

    if (!shape.selected) {
        return null;
    }

    const box = getShapeBounds(shape);

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

    const rotatePosition = { x: middleTop.x, y: middleTop.y - ROTATE_HANDLE_OFFSET };
    const rotation = shape.rotation ?? 0;
    const badgePosition = { x: rotatePosition.x, y: rotatePosition.y - 14 };
    const displayDegrees = ((Math.round(rotation) % 360) + 360) % 360;

    return (
        <>
            <line
                className={handleStyles.rotateLine}
                x1={middleTop.x}
                y1={middleTop.y}
                x2={rotatePosition.x}
                y2={rotatePosition.y}
            />
            <RotateHandle
                key={`rotate + ${shape.id}`}
                active={rotateActive}
                position={rotatePosition}
                shapeId={shape.id}
            />
            {rotateActive && (
                <text
                    className={handleStyles.rotateBadge}
                    x={badgePosition.x}
                    y={badgePosition.y}
                    transform={`rotate(${-rotation} ${badgePosition.x} ${badgePosition.y})`}
                >
                    {displayDegrees}°
                </text>
            )}
            <Handle
                key={`topLeft + ${shape.id}`}
                active={activeHandle === 'topLeft'}
                position={topLeft}
                handlerType="topLeft"
                shapeId={shape.id}
            />
            <Handle
                key={`middleTop + ${shape.id}`}
                active={activeHandle === 'middleTop'}
                position={middleTop}
                handlerType="middleTop"
                shapeId={shape.id}
            />
            <Handle
                key="topRight"
                active={activeHandle === 'topRight'}
                position={topRight}
                handlerType="topRight"
                shapeId={shape.id}
            />
            <Handle
                key={`middleRight + ${shape.id}`}
                active={activeHandle === 'middleRight'}
                position={middleRight}
                handlerType="middleRight"
                shapeId={shape.id}
            />
            <Handle
                key={`bottomRight + ${shape.id}`}
                active={activeHandle === 'bottomRight'}
                position={bottomRight}
                handlerType="bottomRight"
                shapeId={shape.id}
            />
            <Handle
                key={`middleBottom + ${shape.id}`}
                active={activeHandle === 'middleBottom'}
                position={middleBottom}
                handlerType="middleBottom"
                shapeId={shape.id}
            />
            <Handle
                key={`bottomLeft + ${shape.id}`}
                active={activeHandle === 'bottomLeft'}
                position={bottomLeft}
                handlerType="bottomLeft"
                shapeId={shape.id}
            />
            <Handle
                key={`middleLeft + ${shape.id}`}
                active={activeHandle === 'middleLeft'}
                position={middleLeft}
                handlerType="middleLeft"
                shapeId={shape.id}
            />
        </>
    );
};
