import { Action } from 'src/app/types';

export const activateTool: Action<string> = ({ state: { tools } }, toolId) => {
  tools.activeToolsIds.push(toolId);
};

export const deactivateTool: Action<string> = ({ state: { tools } }, toolId) => {
  const index = tools.activeToolsIds.indexOf(toolId);
  if (index > -1) {
    tools.activeTools.splice(index, 1);
  }
};

export const resetTools: Action = ({ state: { tools } }) => {
  tools.activeTools.length = 0;
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
