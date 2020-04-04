import { createLink } from '../factories';

const getLink = (state, linkId) => state.currentDocument.links[linkId];

const setLink = (state, link) => (state.currentDocument.links[link.id] = link);

const deleteLink = (state, linkId) => delete state.currentDocument.links[linkId];

export const addLink = ({ state }, options) => {
  const link = createLink(options);

  setLink(state, link);
};

export const cloneLink = ({ state, effects }, linkId) => {
  const link = getLink(state, linkId);

  setLink(state, { ...link, id: effects.newId() });
};

export const removeLink = ({ state }, linkId) => {
  deleteLink(state, linkId);
};

export const selectLink = ({ state }, linkId) => {
  const link = getLink(state, linkId);

  link.selected = true;
};

export const unselectLink = ({ state }, linkId) => {
  const link = getLink(state, linkId);

  link.selected = false;
};

export const lockLink = ({ state }, linkId) => {
  const link = getLink(state, linkId);

  link.locked = true;
};

export const unlockLink = ({ state }, linkId) => {
  const link = getLink(state, linkId);

  link.locked = false;
};

export const showLink = ({ state }, linkId) => {
  const link = getLink(state, linkId);

  link.visible = true;
};

export const hideLink = ({ state }, linkId) => {
  const link = getLink(state, linkId);

  link.visible = false;
};

export const updateLink = ({ state }, options) => {
  const link = getLink(state, options.id);

  setLink(state, { ...link, options });
};
