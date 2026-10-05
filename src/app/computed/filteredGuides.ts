import { derived } from 'overmind';
import { Application } from '../types';

export const filteredGuides = derived(({ currentDocument }: Application) => {
    const { filter, guides } = currentDocument;

    return Object.keys(guides).filter((key) => {
        const guide = guides[key];

        return guide.name?.includes(filter);
    });
});
