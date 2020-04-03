export const activateTool = ({ state = { activeTools } }, toolId) => {
  activeTools.push(toolId);
};
