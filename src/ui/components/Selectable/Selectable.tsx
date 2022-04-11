import React, { FC } from 'react';
import { useActions } from 'src/app/hooks';
import { Position, Shape, Size } from 'src/app/types';
import { getBBox } from 'src/app/utils';
import { Handle } from '../Handle';

export const Resizable: FC<{ shape: Shape }> = ({ shape, children }) => {
  const bbox = getBBox(shape);

  const {
    topLeft,
    topRight,
    bottomLeft,
    bottomRight,
    middleLeft,
    middleRight,
    middleTop,
    middleBottom
  } = calcBoundingPoints(bbox);

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

  return (
    <Resizable shape={shape}>
      <g onClick={() => toggleShapeSelected(shape.id)}>{children}</g>
    </Resizable>
  );
};
function calcBoundingPoints(bbox: { point: Position; size: Size }) {
  const topLeft = { x: bbox.point!.x, y: bbox.point!.y };
  const topRight = { x: bbox.point!.x + bbox.size.width, y: bbox.point!.y };
  const bottomLeft = { x: bbox.point!.x, y: bbox.point!.y + bbox.size.height };
  const bottomRight = { x: bbox.point!.x + bbox.size.width, y: bbox.point!.y + bbox.size.height };

  const middleLeft = { x: bbox.point!.x, y: bbox.point!.y + bbox.size?.height / 2 };
  const middleRight = {
    x: bbox.point!.x + bbox.size.width,
    y: bbox.point!.y + bbox.size?.height / 2
  };
  const middleTop = { x: bbox.point!.x + bbox.size?.width / 2, y: bbox.point!.y };
  const middleBottom = {
    x: bbox.point!.x + bbox.size?.width / 2,
    y: bbox.point!.y + bbox.size.height
  };

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
