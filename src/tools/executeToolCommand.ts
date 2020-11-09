import { Action } from 'src/app/types';

export const executeToolCommand: Action<string> = ({ state, actions }) => {
  // Get active tools
  const { activeTools } = state.tools;
  // Get tool command
  for (const tool of activeTools) {
    console.log(`Execute command: ${tool.code}`);

    // Create new shape
    const options = tool.factory(state.events.pointer);

    // Insert new shape into store
    actions.addShape(options);
  }
};
