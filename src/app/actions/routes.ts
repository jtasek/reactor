import { Action, AsyncAction } from 'src/app/types';

export const showDesigner: Action = ({ state }) => {
  console.log('showDesigner');
  state.currentPage = 'designer';
};

export const showDocuments: Action = ({ state }) => {
  console.log('showDocuments');
  state.currentPage = 'documents';
};