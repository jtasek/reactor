import { createRuler, newId } from '../factories';

const getRuler = (state, rulerId) => state.currentDocument.rulers[rulerId];

const setRuler = (state, ruler) =>
  (state.currentDocument.rulers[ruler.id] = ruler);

const deleteRuler = (state, rulerId) =>
  delete state.currentDocument.rulers[rulerId];

export const addRuler = ({ state }, options) => {
  const ruler = createRuler(options);

  setRuler(state, ruler);
};

export const cloneRuler = ({ state }, rulerId) => {
  const ruler = getRuler(state, rulerId);

  setRuler(state, { ...ruler, id: newId() });
};

export const removeRuler = ({ state }, rulerId) => {
  deleteRuler(state, rulerId);
};

export const selectRuler = ({ state }, rulerId) => {
  const ruler = getRuler(state, rulerId);

  ruler.selected = true;
};

export const unselectRuler = ({ state }, rulerId) => {
  const ruler = getRuler(state, rulerId);

  ruler.selected = false;
};

export const lockRuler = ({ state }, rulerId) => {
  const ruler = getRuler(state, rulerId);

  ruler.locked = true;
};

export const unlockRuler = ({ state }, rulerId) => {
  const ruler = getRuler(state, rulerId);

  ruler.locked = false;
};

export const showRuler = ({ state }, rulerId) => {
  const ruler = getRuler(state, rulerId);

  ruler.visible = true;
};

export const hideRuler = ({ state }, rulerId) => {
  const ruler = getRuler(state, rulerId);

  ruler.visible = false;
};

export const updateRuler = ({ state }, options) => {
  const ruler = getRuler(state, options.id);

  setRuler(state, { ...ruler, options });
};
