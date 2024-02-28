import { ActionWithParam, Application, Group } from '../types';
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

export const addGroup: ActionWithParam<Partial<Group>> = ({ state }, options) => {
  const group = createGroup(options);

  setGroup(state, group);
};

export const cloneGroup: ActionWithParam<string> = ({ state, effects }, groupId) => {
  const group = getGroup(state, groupId);

  setGroup(state, { ...group, id: effects.newId() });
};

export const removeGroup: ActionWithParam<string> = ({ state }, groupId) => {
  deleteGroup(state, groupId);
};

export const toggleGroupSelected: ActionWithParam<string> = ({ state }, groupId) => {
  const group = getGroup(state, groupId);

  group.selected = !group.selected;
};

export const unselectGroup: ActionWithParam<string> = ({ state }, groupId) => {
  const group = getGroup(state, groupId);

  group.selected = false;
};

export const toggleGroupLocked: ActionWithParam<string> = ({ state }, groupId) => {
  const group = getGroup(state, groupId);

  group.locked = !group.locked;
};

export const lockGroup: ActionWithParam<string> = ({ state }, groupId) => {
  const group = getGroup(state, groupId);

  group.locked = true;
};

export const unlockGroup: ActionWithParam<string> = ({ state }, groupId) => {
  const group = getGroup(state, groupId);

  group.locked = false;
};

export const showGroup: ActionWithParam<string> = ({ state }, groupId) => {
  const group = getGroup(state, groupId);

  group.visible = true;
};

export const hideGroup: ActionWithParam<string> = ({ state }, groupId) => {
  const group = getGroup(state, groupId);

  group.visible = false;
};

export const toggleGroupVisible: ActionWithParam<string> = ({ state }, groupId) => {
  const group = getGroup(state, groupId);

  group.visible = !group.visible;
};

export const updateGroup: ActionWithParam<Partial<Group> & { id: string }> = ({ state }, options) => {
  const group = getGroup(state, options.id);

  setGroup(state, { ...group, ...options });
};
