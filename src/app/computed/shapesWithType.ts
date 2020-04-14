import { Derive } from 'overmind';
import { Application } from '../types';

export const shapesWithTypes: Derive<Application, { id: string; type: string }[]> = ({
  currentDocument: { shapes }
}) => {
  return Object.keys(shapes).map((key) => {
    const shape = shapes[key];

    return {
      id: shape.id,
      type: shape.type
    };
  });
};
