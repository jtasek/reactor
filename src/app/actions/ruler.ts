import { ActionWithParam, Application, Ruler } from '../types';
import { createRuler } from '../factories';

const getRuler = ({ currentDocument }: Application, rulerId: string) => {
  const ruler = currentDocument.rulers[rulerId];

  if (!ruler) {
    throw new Error(`Ruler ${rulerId} not found`);
  }

  return ruler;
};

const setRuler = ({ currentDocument }: Application, ruler: Ruler) => {
  if (currentDocument) {
    currentDocument.rulers[ruler.id] = ruler;
  }
};

const deleteRuler = ({ currentDocument }: Application, rulerId: string) =>
  delete currentDocument.rulers[rulerId];

export const addRuler: ActionWithParam<Partial<Ruler>> = ({ state }, options) => {
  const ruler = createRuler(options);

  setRuler(state, ruler);
};

export const cloneRuler: ActionWithParam<string> = ({ state, effects }, rulerId) => {
  const ruler = getRuler(state, rulerId);

  setRuler(state, { ...ruler, id: effects.newId() });
};

export const removeRuler: ActionWithParam<string> = ({ state }, rulerId) => {
  deleteRuler(state, rulerId);
};

export const toggleRulerSelected: ActionWithParam<string> = ({ state }, rulerId) => {
  const ruler = getRuler(state, rulerId);

  ruler.selected = !ruler.selected;
};

export const unselectRuler: ActionWithParam<string> = ({ state }, rulerId) => {
  const ruler = getRuler(state, rulerId);

  ruler.selected = false;
};

export const lockRuler: ActionWithParam<string> = ({ state }, rulerId) => {
  const ruler = getRuler(state, rulerId);

  ruler.locked = true;
};

export const unlockRuler: ActionWithParam<string> = ({ state }, rulerId) => {
  const ruler = getRuler(state, rulerId);

  ruler.locked = false;
};

export const showRuler: ActionWithParam<string> = ({ state }, rulerId) => {
  const ruler = getRuler(state, rulerId);

  ruler.visible = true;
};

export const hideRuler: ActionWithParam<string> = ({ state }, rulerId) => {
  const ruler = getRuler(state, rulerId);

  ruler.visible = false;
};

export const updateRuler: ActionWithParam<Partial<Ruler> & { id: string }> = ({ state }, options) => {
  const ruler = getRuler(state, options.id);

  setRuler(state, { ...ruler, ...options });
};
