import { Action } from 'overmind';
import { Application, Ruler } from '../types';
import { createRuler } from '../factories';

const getRuler = (state: Application, rulerId: string) => state.currentDocument?.rulers[rulerId];

const setRuler = (state: Application, ruler: Ruler) =>
  (state.currentDocument?.rulers[ruler.id] = ruler);

const deleteRuler = (state: Application, rulerId: string) =>
  delete state.currentDocument?.rulers[rulerId];

export const addRuler: Action<Partial<Ruler>> = ({ state }, options) => {
  const ruler = createRuler(options);

  setRuler(state, ruler);
};

export const cloneRuler: Action<string> = ({ state, effects }, rulerId) => {
  const ruler = getRuler(state, rulerId);

  setRuler(state, { ...ruler, id: effects.newId() });
};

export const removeRuler: Action<string> = ({ state }, rulerId) => {
  deleteRuler(state, rulerId);
};

export const selectRuler: Action<string> = ({ state }, rulerId) => {
  const ruler = getRuler(state, rulerId);

  ruler.selected = true;
};

export const unselectRuler: Action<string> = ({ state }, rulerId) => {
  const ruler = getRuler(state, rulerId);

  ruler.selected = false;
};

export const lockRuler: Action<string> = ({ state }, rulerId) => {
  const ruler = getRuler(state, rulerId);

  ruler.locked = true;
};

export const unlockRuler: Action<string> = ({ state }, rulerId) => {
  const ruler = getRuler(state, rulerId);

  ruler.locked = false;
};

export const showRuler: Action<string> = ({ state }, rulerId) => {
  const ruler = getRuler(state, rulerId);

  ruler.visible = true;
};

export const hideRuler: Action<string> = ({ state }, rulerId) => {
  const ruler = getRuler(state, rulerId);

  ruler.visible = false;
};

export const updateRuler: Action<Partial<Ruler> & { id: string }> = ({ state }, options) => {
  const ruler = getRuler(state, options.id);

  setRuler(state, { ...ruler, ...options });
};
