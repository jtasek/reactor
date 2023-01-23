import React, { FC } from 'react';
import { useActions, useAppState, useEffects, useTools } from 'src/app/hooks';
import { getToolById } from '..';

export const Stack: FC = () => {
  const { activeToolsIds } = useTools();
  const actions = useActions();
  const state = useAppState();
  const effects = useEffects();

  return (
    <g id="tools">
      {activeToolsIds.map((toolId) => {
        const tool = getToolById(toolId);

        if (!tool) {
          throw new Error(`Tool ${toolId} not found`);
        }

        return tool.command.execute({ state, effects, actions });
      })}
    </g>
  );
};
