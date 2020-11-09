import { Action } from '../types';

export const search: Action<string, void> = ({ state }, filter) => {
  if (state.currentDocument) {
    state.currentDocument.filter = filter;
  }
};
