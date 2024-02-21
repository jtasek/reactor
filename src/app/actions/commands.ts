import { ExecuteAction, ActionGuard } from '../types';
import { Context } from '../hooks';

export const canExecuteCommand = (context: Context, actionGuard: ActionGuard) => {
  return actionGuard(context);
};


export const executeCommand = (context: Context, action: ExecuteAction) => {
  action(context);
};
