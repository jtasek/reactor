import { Command } from '../types';

export const registerCommand: Action<Command> = (state, command) => {
  state.commands[command.id] = command;
};

export const executeCommand: Action<string> = ({ effects }, command) => {
  effects.execute(command);
};
