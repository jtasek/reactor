import { Action } from 'overmind';
import { Application, Link } from '../types';
import { createLink } from '../factories';

const getLink = (state: Application, linkId: string) => state.currentDocument?.links[linkId];

const setLink = (state: Application, link: Link) => (state.currentDocument?.links[link.id] = link);

const deleteLink = (state: Application, linkId: string) =>
  delete state.currentDocument?.links[linkId];

export const addLink: Action<Partial<Link>> = ({ state }, options) => {
  const link = createLink(options);

  setLink(state, link);
};

export const cloneLink: Action<string> = ({ state, effects }, linkId) => {
  const link = getLink(state, linkId);

  setLink(state, { ...link, id: effects.newId() });
};

export const removeLink: Action<string> = ({ state }, linkId) => {
  deleteLink(state, linkId);
};

export const selectLink: Action<string> = ({ state }, linkId) => {
  const link = getLink(state, linkId);

  link.selected = true;
};

export const unselectLink: Action<string> = ({ state }, linkId) => {
  const link = getLink(state, linkId);

  link.selected = false;
};

export const lockLink: Action<string> = ({ state }, linkId) => {
  const link = getLink(state, linkId);

  link.locked = true;
};

export const unlockLink: Action<string> = ({ state }, linkId) => {
  const link = getLink(state, linkId);

  link.locked = false;
};

export const showLink: Action<string> = ({ state }, linkId) => {
  const link = getLink(state, linkId);

  link.visible = true;
};

export const hideLink: Action<string> = ({ state }, linkId) => {
  const link = getLink(state, linkId);

  link.visible = false;
};

export const updateLink: Action<Partial<Link> & { id: string }> = ({ state }, options) => {
  const link = getLink(state, options.id);

  setLink(state, { ...link, ...options });
};