import { derived } from 'overmind';
import { Application } from '../types';

export const filteredLayers = derived(({ currentDocument }: Application) => {
  const { filter, layers } = currentDocument;

  return Object.keys(layers).filter((key) => {
    const layer = layers[key];

    return layer.name?.includes(filter);
  });
});
