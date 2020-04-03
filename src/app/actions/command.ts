import { Action } from 'overmind';

export const executeCommand: Action<string> = ({ effects }, command) => {
  effects.execute(command);
};
