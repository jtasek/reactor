import { Action } from 'overmind';
import { Application, Group } from '../types';
import { createGroup } from '../factories';

const getGroup = ({ currentDocument }: Application, groupId: string) => {
  const group = currentDocument.groups[groupId];

  if (!group) {
    throw new Error(`Group ${groupId} not found`);
  }

  return group;
};

const setGroup = ({ currentDocument }: Application, group: Group) => {
  if (currentDocument) {
    currentDocument.groups[group.id] = group;
  }
};

const deleteGroup = ({ currentDocument }: Application, groupId: string) =>
  delete currentDocument.groups[groupId];

export const addGroup: Action<Partial<Group>> = ({ state }, options) => {
  const group = createGroup(options);

  setGroup(state, group);
};

export const cloneGroup: Action<string> = ({ state, effects }, groupId) => {
  const group = getGroup(state, groupId);

  setGroup(state, { ...group, id: effects.newId() });
};

export const removeGroup: Action<string> = ({ state }, groupId) => {
  deleteGroup(state, groupId);
};

export const selectGroup: Action<string> = ({ state }, groupId) => {
  const group = getGroup(state, groupId);

  group.selected = true;
};

export const unselectGroup: Action<string> = ({ state }, groupId) => {
  const group = getGroup(state, groupId);

  group.selected = false;
};

export const lockGroup: Action<string> = ({ state }, groupId) => {
  const group = getGroup(state, groupId);

  group.locked = true;
};

export const unlockGroup: Action<string> = ({ state }, groupId) => {
  const group = getGroup(state, groupId);

  group.locked = false;
};

export const showGroup: Action<string> = ({ state }, groupId) => {
  const group = getGroup(state, groupId);

  group.visible = true;
};

export const hideGroup: Action<string> = ({ state }, groupId) => {
  const group = getGroup(state, groupId);

  group.visible = false;
};

export const updateGroup: Action<Partial<Group> & { id: string }> = ({ state }, options) => {
  const group = getGroup(state, options.id);

  setGroup(state, { ...group, ...options });
};
