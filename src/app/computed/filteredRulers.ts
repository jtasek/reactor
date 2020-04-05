import { Derive } from 'overmind';
import { Application } from '../types';

export const filteredRulers: Derive<Application, string[]> = ({ currentDocument }) => {
  if (!currentDocument) {
    return;
  }

  const { filter, rulers } = currentDocument;

  return Object.keys(rulers).filter((key) => {
    const ruler = rulers[key];

    return ruler.name?.includes(filter);
  });
};
