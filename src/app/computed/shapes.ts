import { derived } from 'overmind';
import { Application } from '../types';

export const shapeIds = derived(({ currentDocument }: Application) =>
  Object.keys(currentDocument?.shapes || [])
);
