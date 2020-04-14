import { Derive } from 'overmind';
import { Application } from '../types';

export const shapes: Derive<Application, string[]> = ({ currentDocument: { shapes } }) =>
  Object.keys(shapes);
