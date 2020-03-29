import { createLink, newId } from '../factories';

const getLink = (state, linkId) => state.currentDocument.links[linkId];

const setLink = (state, link) => (state.currentDocument.links[link.id] = link);

const deleteLink = (state, linkId) =>
  delete state.currentDocument.links[linkId];

export const addlink = ({ state }, options) => {
  const link = createLink(options);

  setLink(state, link);
};

export const clonelink = ({ state }, linkId) => {
  const link = getLink(state, linkId);

  setLink(state, { ...link, id: newId() });
};

export const removelink = ({ state }, linkId) => {
  deleteLink(state, linkId);
};

export const selectlink = ({ state }, linkId) => {
  const link = getLink(state, linkId);

  link.selected = true;
};

export const unselectlink = ({ state }, linkId) => {
  const link = getLink(state, linkId);

  link.selected = false;
};

export const locklink = ({ state }, linkId) => {
  const link = getLink(state, linkId);

  link.locked = true;
};

export const unlocklink = ({ state }, linkId) => {
  const link = getLink(state, linkId);

  link.locked = false;
};

export const showlink = ({ state }, linkId) => {
  const link = getLink(state, linkId);

  link.visible = true;
};

export const hidelink = ({ state }, linkId) => {
  const link = getLink(state, linkId);

  link.visible = false;
};

export const updatelink = ({ state }, options) => {
  const link = getLink(state, options.id);

  setLink(state, { ...link, options });
};
