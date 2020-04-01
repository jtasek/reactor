import { createGroup } from '../factories';

const getGroup = (state, groupId) => state.currentDocument.groups[groupId];

const setGroup = (state, group) => (state.currentDocument.groups[group.id] = group);

const deleteGroup = (state, groupId) => delete state.currentDocument.groups[groupId];

export const addGroup = ({ state }, options) => {
  const group = createGroup(options);

  setGroup(state, group);
};

export const cloneGroup = ({ state, effects }, groupId) => {
  const group = getGroup(state, groupId);

  setGroup(state, { ...group, id: effects.newId() });
};

export const removeGroup = ({ state }, groupId) => {
  deleteGroup(state, groupId);
};

export const selectGroup = ({ state }, groupId) => {
  const group = getGroup(state, groupId);

  group.selected = true;
};

export const unselectGroup = ({ state }, groupId) => {
  const group = getGroup(state, groupId);

  group.selected = false;
};

export const lockGroup = ({ state }, groupId) => {
  const group = getGroup(state, groupId);

  group.locked = true;
};

export const unlockGroup = ({ state }, groupId) => {
  const group = getGroup(state, groupId);

  group.locked = false;
};

export const showGroup = ({ state }, groupId) => {
  const group = getGroup(state, groupId);

  group.visible = true;
};

export const hideGroup = ({ state }, groupId) => {
  const group = getGroup(state, groupId);

  group.visible = false;
};

export const updateGroup = ({ state }, options) => {
  const group = getGroup(state, options.id);

  setGroup(state, { ...group, options });
};
