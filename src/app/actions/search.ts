import { Action } from '../types';

export const search: Action<string> = ({ state }, filter) => {
  if (state.currentDocument) {
    state.currentDocument.filter = filter;
  }
};
