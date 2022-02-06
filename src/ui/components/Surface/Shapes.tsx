import React, { FC } from 'react';
import { useAppState } from 'src/app/hooks';

import { getComponentByType } from '../../../tools/components';

export const Shapes: FC = () => {
  const { currentDocument } = useAppState();

  return (
    <g id="shapes">
      {Object.values(currentDocument.shapes).map((shape) => {
        const component = getComponentByType(shape.type);

        if (!component) {
          return null;
        }

        return React.createElement(component, {
          key: shape.id,
          ...shape
        });
      })}
    </g>
  );
};
