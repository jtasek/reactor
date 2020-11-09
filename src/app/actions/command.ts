import { Action } from '../types';

export const executeCommand: Action<string> = ({ effects }, command) => {
  effects.execute(command);
};
