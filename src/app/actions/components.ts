import { Action, Application, Component } from '../types';
import { createComponent } from '../factories';

const getComponent = ({ currentDocument }: Application, componentId: string) => {
  const component = currentDocument.components[componentId];

  if (!component) {
    throw new Error(`Component ${componentId} not found`);
  }

  return component;
};

const setComponent = ({ currentDocument }: Application, component: Component) => {
  if (currentDocument) {
    currentDocument.components[component.id] = component;
  }
};

const deleteComponent = ({ currentDocument }: Application, componentId: string) =>
  delete currentDocument.components[componentId];

export const addComponent: Action<Partial<Component>> = ({ state }, options) => {
  const component = createComponent(options);

  setComponent(state, component);
};

export const cloneComponent: Action<string> = ({ state, effects }, componentId) => {
  const component = getComponent(state, componentId);

  setComponent(state, { ...component, id: effects.newId() });
};

export const removeComponent: Action<string> = ({ state }, componentId) => {
  deleteComponent(state, componentId);
};

export const toggleComponentSelected: Action<string> = ({ state }, componentId) => {
  const component = getComponent(state, componentId);

  component.selected = !component.selected;
};

export const unselectComponent: Action<string> = ({ state }, componentId) => {
  const component = getComponent(state, componentId);

  component.selected = false;
};

export const toggleComponentLocked: Action<string> = ({ state }, componentId) => {
  const component = getComponent(state, componentId);

  component.locked = !component.locked;
};

export const lockComponent: Action<string> = ({ state }, componentId) => {
  const component = getComponent(state, componentId);

  component.locked = true;
};

export const unlockComponent: Action<string> = ({ state }, componentId) => {
  const component = getComponent(state, componentId);

  component.locked = false;
};

export const showComponent: Action<string> = ({ state }, componentId) => {
  const component = getComponent(state, componentId);

  component.visible = true;
};

export const hideComponent: Action<string> = ({ state }, componentId) => {
  const component = getComponent(state, componentId);

  component.visible = false;
};

export const toggleComponentVisible: Action<string> = ({ state }, componentId) => {
  const component = getComponent(state, componentId);

  component.visible = !component.visible;
};

export const updateComponent: Action<Partial<Component> & { id: string }> = (
  { state },
  options
) => {
  const component = getComponent(state, options.id);

  setComponent(state, { ...component, ...options });
};
