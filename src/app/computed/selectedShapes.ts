import { Application } from '../types';

export const selectedShapes = ({ currentDocument }: Application): string[] => {
  if (!currentDocument) {
    return [];
  }

  return Object.keys(currentDocument?.shapes).filter(
    (key) => currentDocument?.shapes[key].selected
  );
};
