import { ActionWithParam, Application, Link } from '../types';
import { createLink } from '../factories';

const getLink = ({ currentDocument }: Application, linkId: string) => {
    const link = currentDocument.links[linkId];

    if (!link) {
        throw new Error(`Link ${linkId} not found`);
    }

    return link;
};

const setLink = ({ currentDocument }: Application, link: Link) => {
    if (currentDocument) {
        currentDocument.links[link.id] = link;
    }
};

const deleteLink = ({ currentDocument }: Application, linkId: string) =>
    delete currentDocument.links[linkId];

export const addLink: ActionWithParam<Partial<Link>> = ({ state }, options) => {
    const link = createLink(options);

    setLink(state, link);
};

export const removeLink: ActionWithParam<string> = ({ state }, linkId) => {
    deleteLink(state, linkId);
};

export const updateLink: ActionWithParam<Partial<Link> & { id: string }> = ({ state }, options) => {
    const link = getLink(state, options.id);

    setLink(state, { ...link, ...options });
};
