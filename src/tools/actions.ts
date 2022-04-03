import { Action } from 'src/app/types';
import { Pointer } from 'src/events/types';
import { getTool } from './components';

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

function rescalePointer(pointer: Pointer) {
  return {
    ...pointer,
    centre: pointer.scaledCentre,
    position: pointer.scaledPosition,
    offset: pointer.scaledOffset,
    path: pointer.scaledPath,
    radius: pointer.scaledRadius,
    size: pointer.scaledSize,
    startPosition: pointer.scaledStartPosition,
    topLeftPosition: pointer.scaledTopLeftPosition,
    bottomRightPosition: pointer.scaledBottomRightPosition
  };
}

export const executeToolCommand: Action = ({ state, actions }) => {
  const { activeToolsIds } = state.tools;

  for (const toolId of activeToolsIds) {
    const tool = getTool(toolId);
    console.log(`Execute command: ${toolId}`);

    if (tool?.factory) {
      // Rescale pointer accorrding to the current zoom
      const pointer = rescalePointer(state.events.pointer);

      // Create new shape
      const options = tool.factory(pointer, state.events.keyboard);

      // Insert new shape into the store
      actions.addShape({ ...options, selected: false });
    }
  }
};
