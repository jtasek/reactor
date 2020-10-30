import { derived } from 'overmind';
import { Application } from '../types';

export const filteredGroups = derived(({ currentDocument }: Application) => {
  const { filter, groups } = currentDocument;

  return Object.keys(groups).filter((key) => {
    const group = groups[key];

    return group.name?.includes(filter);
  });
});
