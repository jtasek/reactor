import { derived } from 'overmind';
import { Application } from '../types';

export const selectedShapeCount = derived(
  ({ currentDocument }: Application) => currentDocument?.selectedShapes.length ?? 0
);
