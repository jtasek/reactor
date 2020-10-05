import { derived } from 'overmind';
import { Application } from '../types';

export const filteredLinks = derived(({ currentDocument }: Application) => {
  if (!currentDocument) {
    return [];
  }

  const { filter, links } = currentDocument;

  return Object.keys(links).filter((key) => {
    const link = links[key];

    return link.name?.includes(filter);
  });
});
