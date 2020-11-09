import React, { FC } from 'react';
import { useState } from 'src/app/hooks';

import { components } from '../../../tools';

export function getComponentByType(type: string): FC {
  return components[type];
}

export const Shapes: FC = () => {
  const { currentDocument } = useState();

  return (
    <g id="shapes">
      {Object.values(currentDocument.shapes).map((shape) =>
        React.createElement(getComponentByType(shape.type), {
          key: shape.id,
          ...shape
        })
      )}
    </g>
  );
};
