import { Action, ActionGuard } from '../types';

import { Context } from '../index';

export const canExecuteCommand = (context: Context, actionGuard: ActionGuard) => {
  return actionGuard(context);
};


export const executeCommand = (context: Context, action: Action) => {
  action(context);
};
