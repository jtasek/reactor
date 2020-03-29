import { createRuler, newId } from '../factories';

const getRuler = (state, rulerId) => state.currentDocument.rulers[rulerId];

const setRuler = (state, ruler) =>
  (state.currentDocument.rulers[ruler.id] = ruler);

const deleteRuler = (state, rulerId) =>
  delete state.currentDocument.rulers[rulerId];

export const addruler = ({ state }, options) => {
  const ruler = createRuler(options);

  setRuler(state, ruler);
};

export const cloneruler = ({ state }, rulerId) => {
  const ruler = getRuler(state, rulerId);

  setRuler(state, { ...ruler, id: newId() });
};

export const removeruler = ({ state }, rulerId) => {
  deleteRuler(state, rulerId);
};

export const selectruler = ({ state }, rulerId) => {
  const ruler = getRuler(state, rulerId);

  ruler.selected = true;
};

export const unselectruler = ({ state }, rulerId) => {
  const ruler = getRuler(state, rulerId);

  ruler.selected = false;
};

export const lockruler = ({ state }, rulerId) => {
  const ruler = getRuler(state, rulerId);

  ruler.locked = true;
};

export const unlockruler = ({ state }, rulerId) => {
  const ruler = getRuler(state, rulerId);

  ruler.locked = false;
};

export const showruler = ({ state }, rulerId) => {
  const ruler = getRuler(state, rulerId);

  ruler.visible = true;
};

export const hideruler = ({ state }, rulerId) => {
  const ruler = getRuler(state, rulerId);

  ruler.visible = false;
};

export const updateruler = ({ state }, options) => {
  const ruler = getRuler(state, options.id);

  setRuler(state, { ...ruler, options });
};
