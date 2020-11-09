import React, { FC } from 'react';
import { Tool } from 'src/tools/types';
import { useState } from 'src/app/hooks';

import { DesignCircle as Circle } from '../Circle';
import { DesignImage as Image } from '../Image';
import { DesignLine as Line } from '../Line';
import { DesignPen as Pen } from '../Pen';
import { DesignRect as Rect } from '../Rect';
import { DesignSelect as Select } from '../Select';
import { DesignText as Text } from '../Text';

const components = {
  circle: Circle,
  image: Image,
  line: Line,
  pen: Pen,
  rect: Rect,
  select: Select,
  text: Text
};

function getComponentByType(type: string): FC {
  return components[type];
}

interface Props {
  tools: Tool[];
}

export const Stack: FC<Props> = ({ tools }) => (
  <g id="tools">
    {Object.values(tools).map((tool) => React.createElement(getComponentByType(tool.code)))}
  </g>
);

export const DynamicStack: FC = () => {
  const { activeTools } = useState().tools;

  return <Stack tools={activeTools} />;
};
