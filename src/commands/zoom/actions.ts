import { Context } from '../../app';

export const zoomIn = ({ actions }: Context) => {
    actions.tools.zoomIn();
};

export const zoomOut = ({ actions }: Context) => {
    actions.tools.zoomOut();
};

export const zoomReset = ({ actions }: Context) => {
    actions.tools.zoomReset();
};
