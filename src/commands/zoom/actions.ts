import { Context } from '../../app';

const DEFAULT_STEP = 0.1;
const DEFAULT_SCALE = 1;

export const zoomIn = (context: Context) => {
  const { currentDocument } = context.state;

  currentDocument.camera.scale += DEFAULT_STEP;
};

export const zoomOut = (context: Context) => {
  const { currentDocument } = context.state;

  currentDocument.camera.scale -= DEFAULT_STEP;
};

export const zoomReset = (context: Context) => {
  const { currentDocument } = context.state;

  currentDocument.camera.scale = DEFAULT_SCALE;
};
