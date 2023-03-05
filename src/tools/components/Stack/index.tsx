import React, { FC } from 'react';
import { useActions, useAppState, useEffects, useTools } from 'src/app/hooks';
import { getToolById } from '..';

export const Stack: FC = () => {
  const { activeToolsIds } = useTools();
  console.log('stack render');

  return (
    <g id="tools">
      {activeToolsIds.map((toolId) => {
        const tool = getToolById(toolId);

        if (!tool) {
          throw new Error(`Tool ${toolId} not found`);
        }

        return React.createElement(tool.component, { key: `design-${toolId}` }, null);
      })}
    </g>
  );
};
