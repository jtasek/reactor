import React, { FC } from 'react';
import { useActions } from 'src/app/hooks';
import { Shape } from 'src/app/types';
import { getBBox } from 'src/app/utils';
import { Handle } from '../Handle';

export const Resizable: FC<{ shape: Shape }> = ({ shape, children }) => {
  const bbox = getBBox(shape);

  const topLeft = { x: bbox.point!.x, y: bbox.point!.y };
  const topRight = { x: bbox.point!.x + bbox.size.width, y: bbox.point!.y };
  const bottomLeft = { x: bbox.point!.x, y: bbox.point!.y + bbox.size.height };
  const bottomRight = { x: bbox.point!.x + bbox.size.width, y: bbox.point!.y + bbox.size.height };

  return (
    <>
      {children}
      <Handle position={topLeft} />
      <Handle position={topRight} />
      <Handle position={bottomLeft} />
      <Handle position={bottomRight} />
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
