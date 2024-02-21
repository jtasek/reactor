import { ExecuteAction } from 'src/app/types';

export const showDesigner: ExecuteAction = ({ state }) => {
  console.log('showDesigner');
  state.currentPage = 'designer';
};

export const showDocuments: ExecuteAction = ({ state }) => {
  console.log('showDocuments');
  state.currentPage = 'documents';
};