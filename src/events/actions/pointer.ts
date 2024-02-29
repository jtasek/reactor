import { ActionWithParam, Point } from '../../app/types';

export const setStartPosition: ActionWithParam<Point> = ({ state }, position) => {
    state.events.pointer.start = position;
};

export const setCurrentPosition: ActionWithParam<Point> = ({ state }, position) => {
    state.events.pointer.current = position;
};

export const updatePath: ActionWithParam<Point> = ({ state }, position) => {
    state.events.pointer.path.push(position);
};

export const startDragging: ActionWithParam<Point> = ({ state }, position) => {
    const pointer = state.events.pointer;
    pointer.dragging = true;
    pointer.start = position;
    pointer.current = position;
    pointer.path = [position];
};

export const dragging: ActionWithParam<Point> = ({ state }, position) => {
    const pointer = state.events.pointer;
    pointer.current = position;
    pointer.path.push(position);
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
