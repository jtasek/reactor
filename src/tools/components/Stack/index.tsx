import React, { FC } from 'react';
import { useState } from 'src/app/hooks';
import { getToolByType } from '..';

interface Props {
  tools: string[];
}

export const Stack: FC<Props> = ({ tools }) => (
  <g id="tools">
    {Object.values(tools).map((item) => {
      const tool = getToolByType(item);
      if (!tool) {
        return null;
      }

      return React.createElement(tool.tool, { key: item });
    })}
  </g>
);

export const DesignStack: FC = () => {
  const { activeToolsIds } = useState().tools;

  return <Stack tools={activeToolsIds} />;
};
