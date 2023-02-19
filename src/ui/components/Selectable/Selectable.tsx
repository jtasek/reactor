import React, { FC } from 'react';

import { useActions } from 'src/app/hooks';
import { Box, Position, Shape, Size } from 'src/app/types';
import { getBoundingBox } from 'src/app/utils';
import { Handle } from '../Handle';

export const Resizable: FC<{ shape: Shape }> = ({ shape, children }) => {
  const box = getBoundingBox(shape);

  if (!box?.topLeft || !box.bottomRight) {
    return children;
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
      {children}
      <Handle key="topLeft" position={topLeft} type="topLeft" shapeId={shape.id} />
      <Handle key="topRight" position={topRight} type="topRight" shapeId={shape.id} />
      <Handle key="bottomLeft" position={bottomLeft} type="bottomLeft" shapeId={shape.id} />
      <Handle key="bottomRight" position={bottomRight} type="bottomRight" shapeId={shape.id} />
      <Handle key="middleLeft" position={middleLeft} type="middleLeft" shapeId={shape.id} />
      <Handle key="middleRight" position={middleRight} type="middleRight" shapeId={shape.id} />
      <Handle key="middleTop" position={middleTop} type="middleTop" shapeId={shape.id} />
      <Handle key="middleBottom" position={middleBottom} type="middleBottom" shapeId={shape.id} />
    </>
  );
};

export const Selectable: FC<{ shape: Shape }> = ({ shape, children }) => {
  const { toggleShapeSelected } = useActions();

  return <g onClick={() => toggleShapeSelected(shape.id)}>{children}</g>;
};

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
