import { Context } from 'src/app/hooks';
import { Pointer } from 'src/events/types';
import { getToolById } from './components';

export const activateTool = ({ state: { tools }, actions }: Context, toolId: string) => {
  tools.activeToolsIds = [toolId];
  actions.ui.hideContextMenu();
};

export const deactivateTool = ({ state: { tools } }: Context, toolId: string) => {
  const index = tools.activeToolsIds.indexOf(toolId);
  if (index > -1) {
    tools.activeToolsIds.splice(index, 1);
  }
};

export const resetTools = ({ state: { events, tools } }: Context) => {
  if (!events.keyboard.shiftKey) {
    tools.activeToolsIds = [];
  }
};

export const zoomIn = ({ state: { currentDocument } }: Context, step = 1) => {
  currentDocument.camera.scale += step;
};

export const zoomOut = ({ state: { currentDocument } }: Context, step = 1) => {
  currentDocument.camera.scale -= step;
};

export const zoomReset = ({ state: { currentDocument } }: Context) => {
  currentDocument.camera.scale = 1;
};

export const zoom = ({ state: { currentDocument } }: Context, scale = 1) => {
  currentDocument.camera.scale = scale;
};

export const moveCamera = (
  { state: { currentDocument } }: Context,
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

export const executeToolCommands = (context: Context) => {
  const { state, actions } = context;
  const { activeToolsIds } = state.tools;

  for (const toolId of activeToolsIds) {
    const tool = getToolById(toolId);
    console.log(`Execute tool command: ${toolId}`);

    tool?.command.execute(context);

    if (tool?.command.factory) {
      // Rescale pointer accorrding to the current zoom
      const pointer = rescalePointer(state.events.pointer);

      // Create new shape
      const options = tool.command.factory(context);

      // Insert new shape into the store
      actions.addShape({ ...options, selected: false });
    }
  }
};
