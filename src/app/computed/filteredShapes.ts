import { Application } from '../types';

export const filteresShapes = ({ currentDocument }: Application): string[] => {
  if (!currentDocument) {
    return [];
  }

  const { filter, shapes } = currentDocument;

  return Object.keys(shapes).filter((key) => {
    const shape = shapes[key];

    return shape.name?.includes(filter);
  });
};
