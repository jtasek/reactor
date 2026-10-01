import React, { FC } from 'react';
import { Box } from '../../../app/types';
import { Handle } from '../Handle';
import { RotateHandle } from '../Handle/RotateHandle';
import handleStyles from '../Handle/styles.css';
import { Props } from './Selectable';
import { getShapeBounds } from '../../../app/utils';
import { resizeCursor } from 'src/app/geometry';
import type { ResizeHandlerType } from 'src/app/types';
import { useCameraScale, usePointer } from 'src/app/hooks';

/** Sizes on screen, in pixels, whatever the zoom. */
const HANDLE_RADIUS = 5;
const ROTATE_HANDLE_OFFSET = 24;
const BADGE_OFFSET = 14;

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
    const scale = useCameraScale();
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

    const rotatePosition = { x: middleTop.x, y: middleTop.y - ROTATE_HANDLE_OFFSET / scale };
    const rotation = shape.rotation ?? 0;
    const badgePosition = { x: rotatePosition.x, y: rotatePosition.y - BADGE_OFFSET / scale };
    const size = HANDLE_RADIUS / scale;
    const handle = (handlerType: ResizeHandlerType) => ({
        active: activeHandle === handlerType,
        cursor: resizeCursor(handlerType, rotation),
        handlerType,
        shapeId: shape.id,
        size
    });
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
                size={size}
            />
            {rotateActive && (
                <text
                    className={handleStyles.rotateBadge}
                    transform={`translate(${badgePosition.x} ${badgePosition.y}) rotate(${-rotation}) scale(${1 / scale})`}
                >
                    {displayDegrees}°
                </text>
            )}
            <Handle key={`topLeft + ${shape.id}`} position={topLeft} {...handle('topLeft')} />
            <Handle key={`middleTop + ${shape.id}`} position={middleTop} {...handle('middleTop')} />
            <Handle key="topRight" position={topRight} {...handle('topRight')} />
            <Handle
                key={`middleRight + ${shape.id}`}
                position={middleRight}
                {...handle('middleRight')}
            />
            <Handle
                key={`bottomRight + ${shape.id}`}
                position={bottomRight}
                {...handle('bottomRight')}
            />
            <Handle
                key={`middleBottom + ${shape.id}`}
                position={middleBottom}
                {...handle('middleBottom')}
            />
            <Handle
                key={`bottomLeft + ${shape.id}`}
                position={bottomLeft}
                {...handle('bottomLeft')}
            />
            <Handle
                key={`middleLeft + ${shape.id}`}
                position={middleLeft}
                {...handle('middleLeft')}
            />
        </>
    );
};
