import { Derive } from 'overmind';
import { Application } from '../types';

export const selectedShapeCount: Derive<Application, number> = ({ currentDocument }) =>
  currentDocument?.selectedShapes.length ?? 0;
