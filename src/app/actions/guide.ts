import { Action, ActionWithParam, Application, Guide } from '../types';
import { createGuide } from '../factories';

const getGuide = ({ currentDocument }: Application, guideId: string) => {
    const guide = currentDocument.guides[guideId];

    if (!guide) {
        throw new Error(`Guide ${guideId} not found`);
    }

    return guide;
};

const setGuide = ({ currentDocument }: Application, guide: Guide) => {
    if (currentDocument) {
        currentDocument.guides[guide.id] = guide;
    }
};

const deleteGuide = ({ currentDocument }: Application, guideId: string) =>
    delete currentDocument.guides[guideId];

export const addGuide: ActionWithParam<Partial<Guide>> = ({ state }, options) => {
    if (state.currentDocument.locked) return;
    const guide = createGuide(options);

    setGuide(state, guide);
};

export const cloneGuide: ActionWithParam<string> = ({ state, effects }, guideId) => {
    const guide = getGuide(state, guideId);

    setGuide(state, { ...guide, id: effects.newId() });
};

export const removeGuide: ActionWithParam<string> = ({ state }, guideId) => {
    const guide = state.currentDocument.guides[guideId];
    if (!guide || guide.locked || state.currentDocument.locked) return;
    deleteGuide(state, guideId);
};

/** Selects one guide, replacing the canvas selection. */
export const selectGuide: ActionWithParam<string> = ({ state, actions }, guideId) => {
    const guide = state.currentDocument.guides[guideId];
    if (!guide?.visible || !state.ui.guides.visible) return;
    actions.unselectShapes();
    state.enteredGroupId = null;
    guide.selected = true;
};

export const unselectGuides: Action = ({ state }) => {
    Object.values(state.currentDocument.guides).forEach((guide) => {
        if (guide.selected) guide.selected = false;
    });
};

export const removeSelectedGuides: Action = ({ state, actions }) => {
    if (!state.ui.guides.visible || state.currentDocument.locked) return;
    Object.values(state.currentDocument.guides).forEach((guide) => {
        if (guide.selected && guide.visible && !guide.locked) actions.removeGuide(guide.id);
    });
};

export const unselectGuide: ActionWithParam<string> = ({ state }, guideId) => {
    const guide = getGuide(state, guideId);

    guide.selected = false;
};

export const lockGuide: ActionWithParam<string> = ({ state }, guideId) => {
    const guide = getGuide(state, guideId);

    guide.locked = true;
};

export const unlockGuide: ActionWithParam<string> = ({ state }, guideId) => {
    const guide = getGuide(state, guideId);

    guide.locked = false;
};

export const showGuide: ActionWithParam<string> = ({ state }, guideId) => {
    const guide = getGuide(state, guideId);

    guide.visible = true;
};

export const hideGuide: ActionWithParam<string> = ({ state }, guideId) => {
    const guide = getGuide(state, guideId);

    guide.visible = false;
};

export const updateGuide: ActionWithParam<Partial<Guide> & { id: string }> = (
    { state },
    options
) => {
    const guide = getGuide(state, options.id);

    if (guide.locked || state.currentDocument.locked) return;

    setGuide(state, { ...guide, ...options });
};
