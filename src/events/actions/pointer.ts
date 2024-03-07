import { Action, ActionWithParam, Point } from '../../app/types';

export const setStartPosition: ActionWithParam<Point> = ({ state }, position) => {
    state.events.pointer.start = position;
};

export const setCurrentPosition: ActionWithParam<Point> = ({ state }, position) => {
    state.events.pointer.current = position;
};

export const updatePath: ActionWithParam<Point> = ({ state }, position) => {
    state.events.pointer.path.push(position);
};

export const startDragging: Action = ({ state }) => {
    state.events.pointer.dragging = true;
};

export const updateCurrentPosition: ActionWithParam<Point> = (context, position) => {
    setCurrentPosition(context, position);
    updatePath(context, position);
};

export const endDragging: ActionWithParam<Point> = ({ state }) => {
    state.events.pointer.dragging = false;
};

export const resetDragging: ActionWithParam<Point> = ({ state }) => {
    const pointer = state.events.pointer;
    pointer.dragging = false;
    pointer.start = { x: 0, y: 0 };
    pointer.current = { x: 0, y: 0 };
    pointer.path.length = 0;
};
