import { Application } from '../types';
import { createGroup } from '../factories';

export const addGroup = ({ currentDocument: { state } }, props) => {
  const group = createGroup(props);

  const { currentDocument } = state;
  state.push(`workspace.groups.${group.id}`, group);
};

export const cloneGroup = ({ props, state }) => {
  const group = state.get(`workspace.groups.${props.id}`);
  group.id = v4();

  state.push(`workspace.groups.${group.id}`, group);

  output({ id: group.id });
};

export const removeGroup = ({ props, state }) => {
  state.unset(`workspace.groups.${props.id}`);
};

export const selectGroup = ({ props, state }) => {
  state.set(`workspace.groups.${props.id}.selected`, true);
};

export const lockGroup = ({ props, state }) => {
  const path = `workspace.groups.${props.id}.locked`;
  state.set(path, !state.get(path));
};

export const showGroup = ({ props, state }) => {
  const path = `workspace.groups.${props.id}.visible`;
  state.set(path, !state.get(path));
};

export const hideGroup = ({ props, state }) => {
  const path = `workspace.groups.${props.id}.visible`;
  state.set(path, !state.get(path));
};

export const updateGroup = ({ props, state }) => {
  state.merge(`workspace.layers.${props.id}`, props);
};
