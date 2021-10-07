import { Action } from 'src/app/types';
import { getToolByType } from './components';

export const activateTool: Action<string> = ({ state: { tools }, actions }, toolId) => {
  tools.activeToolsIds = [toolId];
  actions.ui.hideContextMenu();
};

export const deactivateTool: Action<string> = ({ state: { tools } }, toolId) => {
  const index = tools.activeToolsIds.indexOf(toolId);
  if (index > -1) {
    tools.activeToolsIds.splice(index, 1);
  }
};

export const resetTools: Action = ({ state: { tools } }) => {
  tools.activeToolsIds = [];
};

export const zoomIn: Action<number> = ({ state: { currentDocument } }, step = 1) => {
  currentDocument.camera.scale += step;
};

export const zoomOut: Action<number> = ({ state: { currentDocument } }, step = 1) => {
  currentDocument.camera.scale -= step;
};

export const zoomReset: Action<number> = ({ state: { currentDocument } }) => {
  currentDocument.camera.scale = 1;
};

export const zoom: Action<number> = ({ state: { currentDocument } }, scale = 1) => {
  currentDocument.camera.scale = scale;
};

export const moveCamera: Action<{ deltaX: number; deltaY: number; deltaZ: number }> = (
  { state: { currentDocument } },
  delta: { deltaX: number; deltaY: number; deltaZ: number }
) => {
  currentDocument.camera.position.x -= delta.deltaX;
  currentDocument.camera.position.y -= delta.deltaY;
};

export const executeToolCommand: Action = ({ state, actions }) => {
  const { activeToolsIds } = state.tools;
  // Get tool command
  for (const toolId of activeToolsIds) {
    const tool = getToolByType(toolId);
    console.log(`Execute command: ${toolId}`);

    if (tool?.factory) {
      // Create new shape
      const options = tool.factory(state.events.pointer, state.events.keyboard);
      // Insert new shape into store
      actions.addShape({ ...options, selected: false });
    }
  }
};
