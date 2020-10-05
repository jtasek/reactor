import { Action } from 'overmind';

export const search: Action<string, void> = ({ state }, filter) => {
  if (state.currentDocument) {
    state.currentDocument.filter = filter;
  }
};
