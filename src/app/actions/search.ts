import { Action } from 'overmind';

export const search: Action<string> = ({ state }, filter) => {
  state.currentDocument?.filter = filter;
