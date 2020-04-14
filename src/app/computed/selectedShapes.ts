import { Derive } from 'overmind';
import { Application } from '../types';

export const selectedShapes: Derive<Application, string[]> = ({ currentDocument }) => {
  if (!currentDocument) {
    return [];
  }

  return Object.keys(currentDocument?.shapes).filter(
    (key) => currentDocument?.shapes[key].selected
  );
};
