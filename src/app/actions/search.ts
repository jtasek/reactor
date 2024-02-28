import { ActionWithParam } from '../types';

export const search: ActionWithParam<string> = ({ state }, filter) => {
  if (state.currentDocument) {
    state.currentDocument.filter = filter;
  }
};
