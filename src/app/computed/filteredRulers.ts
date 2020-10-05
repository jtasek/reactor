import { derived } from 'overmind';
import { Application } from '../types';

export const filteredRulers = derived(({ currentDocument }: Application) => {
  if (!currentDocument) {
    return [];
  }

  const { filter, rulers } = currentDocument;

  return Object.keys(rulers).filter((key) => {
    const ruler = rulers[key];

    return ruler.name?.includes(filter);
  });
});
