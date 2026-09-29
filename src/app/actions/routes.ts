import { Action } from 'src/app/types';

export const showDesigner: Action = ({ state }) => {
    state.currentPage = 'designer';
};

export const showAccount: Action = ({ state }) => {
    state.currentPage = 'account';
};

export const showDocuments: Action = ({ state }) => {
    state.currentPage = 'documents';
};
