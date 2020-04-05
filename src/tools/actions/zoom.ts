import { Action } from 'overmind';

export const zoomIn: Action<number> = ({ currentDocument }, step = 1) => {
  currentDocument.camera.scale += step;
};

export const zoomOut: Action<number> = ({ currentDocument }, step = 1) => {
  currentDocument.camera.scale -= step;
};

export const zoomReset: Action<number> = ({ currentDocument }, scale = 1) => {
  currentDocument.camera.scale = scale;
};
