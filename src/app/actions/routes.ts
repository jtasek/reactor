import type { Action, ActionWithParam } from 'src/app/types';

export const showDesigner: Action = ({ state }) => {
    state.currentPage = 'designer';
};

export const showAccount: ActionWithParam<'account' | 'login'> = ({ state }, page) => {
    state.currentPage = page;
};

export const showDocuments: Action = ({ state }) => {
    state.currentPage = 'documents';
};

export const showSharing: Action = ({ state }) => {
    state.currentPage = 'sharing';
};
export const showInvitation: Action = ({ state }) => {
    state.currentPage = 'invitation';
};
