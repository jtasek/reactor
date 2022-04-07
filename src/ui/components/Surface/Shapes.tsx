import React, { FC } from 'react';
import { useActions, useAppState } from 'src/app/hooks';

import { getComponentByType } from '../../../tools/components';
import { Selectable } from '../Selectable/Selectable';

export const Shapes: FC = () => {
  const { currentDocument } = useAppState();

  return (
    <g id="shapes">
      {Object.values(currentDocument.shapes).map((shape) => {
        const component = getComponentByType(shape.type);

        if (!component) {
          return null;
        }

        return React.createElement(
          Selectable,
          {
            shape: shape,
            key: `selectable-${shape.id}`
          },
          React.createElement(component, {
            key: shape.id,
            ...shape
          })
        );
      })}
    </g>
  );
};
