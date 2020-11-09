import { Action } from 'src/app/types';

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
