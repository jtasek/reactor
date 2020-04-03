export const deactivateTool = ({ state = { activeTools } }, toolId) => {
  const index = activeTools.indexOf(toolId);

  activeTools.slice(index, 1);
};
