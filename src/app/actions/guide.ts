import { ActionWithParam, Application, Guide } from '../types';
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
    const guide = createGuide(options);

    setGuide(state, guide);
};

export const cloneGuide: ActionWithParam<string> = ({ state, effects }, guideId) => {
    const guide = getGuide(state, guideId);

    setGuide(state, { ...guide, id: effects.newId() });
};

export const removeGuide: ActionWithParam<string> = ({ state }, guideId) => {
    deleteGuide(state, guideId);
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

    setGuide(state, { ...guide, ...options });
};
