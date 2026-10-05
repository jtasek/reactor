import React, { FC } from 'react';
import type { Box, ResizeHandlerType } from 'src/app/types';
import { Handle } from '../Handle';
import { RadiusHandle } from '../Handle/RadiusHandle';
import { RotateHandle } from '../Handle/RotateHandle';
import handleStyles from '../Handle/styles.css';
import { Props } from './Selectable';
import { getShapeBounds } from 'src/app/utils';
import { CORNERS, resizeCursor } from 'src/app/geometry';
import { useCameraScale, usePointer } from 'src/app/hooks';
import type { HandleOwner } from 'src/events/types';

/** Sizes on screen, in pixels, whatever the zoom. */
const HANDLE_RADIUS = 5;
const ROTATE_HANDLE_OFFSET = 24;
const BADGE_OFFSET = 14;
/** Below this length on screen, handles along a side would cover the shape. */
const MIN_HANDLED_SIDE = 6 * HANDLE_RADIUS;

const MIDDLES: ResizeHandlerType[] = ['middleTop', 'middleRight', 'middleBottom', 'middleLeft'];

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

interface HandlesProps {
    box: Box;
    rotation: number;
    owner: HandleOwner;
    activeHandle?: ResizeHandlerType;
    rotateActive: boolean;
}

/** Resize and rotate handles around `box`, drawn in its turned frame. */
export const Handles: FC<HandlesProps> = ({ box, rotation, owner, activeHandle, rotateActive }) => {
    const scale = useCameraScale();
    const points = calcBoundingPoints(box);
    const { middleTop } = points;

    const rotatePosition = { x: middleTop.x, y: middleTop.y - ROTATE_HANDLE_OFFSET / scale };
    const badgePosition = { x: rotatePosition.x, y: rotatePosition.y - BADGE_OFFSET / scale };
    const size = HANDLE_RADIUS / scale;
    // Corners stay while either side is long enough to keep them apart; middle
    // handles need both, as they would otherwise meet the corners or each other.
    const longSides = [box.width, box.height].filter(
        (side) => side * scale >= MIN_HANDLED_SIDE
    ).length;
    const shown: ResizeHandlerType[] = [
        ...(longSides > 0 ? CORNERS : []),
        ...(longSides > 1 ? MIDDLES : [])
    ];

    if (activeHandle && !shown.includes(activeHandle)) {
        shown.push(activeHandle);
    }

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
                active={rotateActive}
                position={rotatePosition}
                owner={owner}
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
            {shown.map((handlerType) => (
                <Handle
                    key={handlerType}
                    active={activeHandle === handlerType}
                    cursor={resizeCursor(handlerType, rotation)}
                    handlerType={handlerType}
                    position={points[handlerType]}
                    owner={owner}
                    size={size}
                />
            ))}
        </>
    );
};

export const Resizable: FC<Props> = ({ shape }) => {
    const { gesture } = usePointer();
    const activeHandle =
        gesture.kind === 'resizing' && gesture.shapeId === shape.id ? gesture.handle : undefined;
    const rotateActive = gesture.kind === 'rotating' && gesture.shapeId === shape.id;
    const activeCorner =
        gesture.kind === 'rounding' && gesture.shapeId === shape.id ? gesture.corner : undefined;

    if (!shape.selected) {
        return null;
    }

    const box = getShapeBounds(shape);

    if (!box?.topLeft || !box?.bottomRight) {
        return null;
    }

    return (
        <>
            <Handles
                box={box}
                rotation={shape.rotation ?? 0}
                owner={{ shapeId: shape.id }}
                activeHandle={activeHandle}
                rotateActive={rotateActive}
            />
            {shape.type === 'rectangle' && (
                <RadiusHandle rectangle={shape} activeCorner={activeCorner} />
            )}
        </>
    );
};
