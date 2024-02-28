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

export const cloneLink: ActionWithParam<string> = ({ state, effects }, linkId) => {
  const link = getLink(state, linkId);

  setLink(state, { ...link, id: effects.newId() });
};

export const removeLink: ActionWithParam<string> = ({ state }, linkId) => {
  deleteLink(state, linkId);
};

export const toggleLinkSelected: ActionWithParam<string> = ({ state }, linkId) => {
  const link = getLink(state, linkId);

  link.selected = !link.selected;
};

export const unselectLink: ActionWithParam<string> = ({ state }, linkId) => {
  const link = getLink(state, linkId);

  link.selected = false;
};

export const lockLink: ActionWithParam<string> = ({ state }, linkId) => {
  const link = getLink(state, linkId);

  link.locked = true;
};

export const unlockLink: ActionWithParam<string> = ({ state }, linkId) => {
  const link = getLink(state, linkId);

  link.locked = false;
};

export const showLink: ActionWithParam<string> = ({ state }, linkId) => {
  const link = getLink(state, linkId);

  link.visible = true;
};

export const hideLink: ActionWithParam<string> = ({ state }, linkId) => {
  const link = getLink(state, linkId);

  link.visible = false;
};

export const updateLink: ActionWithParam<Partial<Link> & { id: string }> = ({ state }, options) => {
  const link = getLink(state, options.id);

  setLink(state, { ...link, ...options });
};
