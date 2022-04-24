import React, { FC } from 'react';
import { useShape } from 'src/app/hooks';
import { getComponentByType } from 'src/tools/components';
import { Resizable, Selectable } from '../Selectable/Selectable';

interface Props {
  shapeId: string;
}

export const Shape: FC<Props> = ({ shapeId }) => {
  const shape = useShape(shapeId);

  const component = getComponentByType(shape.type);

  if (!component) {
    console.error(`Component ${shape.type} not found`);
    return null;
  }

  if (shape.selected) {
    return React.createElement(
      Resizable,
      {
        shape: shape,
        key: `selectable-${shape.id}`
      },
      React.createElement(component, {
        key: `${shape.type}-${shape.id}`,
        ...shape
      })
    );
  }

  return React.createElement(
    Selectable,
    {
      shape: shape,
      key: `selectable-${shape.id}`
    },
    React.createElement(component, {
      key: `${shape.type}-${shape.id}`,
      ...shape
    })
  );
};
