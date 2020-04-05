import { Derive } from 'overmind';
import { Application } from '../types';

export const filteredGroups: Derive<Application, string[]> = ({ currentDocument }) => {
  if (!currentDocument) {
    return;
  }

  const { filter, groups } = currentDocument;

  return Object.keys(groups).filter((key) => {
    const group = groups[key];

    return group.name?.includes(filter);
  });
};
