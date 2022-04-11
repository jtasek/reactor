import React, { FC } from 'react';
import { useTools } from 'src/app/hooks';
import { getTool } from '..';

interface Props {
  tools: string[];
}

export const Stack: FC<Props> = ({ tools }) => (
  <g id="tools">
    {Object.values(tools).map((item) => {
      const tool = getTool(item);
      if (!tool) {
        return null;
      }

      return React.createElement(tool.tool, { key: item });
    })}
  </g>
);

export const DesignStack: FC = () => {
  const { activeToolsIds } = useTools();

  return <Stack tools={activeToolsIds} />;
};
