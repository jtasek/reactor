import { Derive } from 'overmind';
import { Application } from '../types';

export const filteredLayers: Derive<Application, string[]> = ({ currentDocument }) => {
  if (!currentDocument) {
    return;
  }

  const { filter, layers } = currentDocument;

  return Object.keys(layers).filter((key) => {
    const layer = layers[key];

    return layer.name?.includes(filter);
  });
};
