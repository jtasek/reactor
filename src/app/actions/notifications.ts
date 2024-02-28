import { ActionWithParam } from '../types';
import { createNotification } from '../factories';

export const displayInfo: ActionWithParam<string> = ({ state }, message) => {
  const notification = createNotification({ message, type: 'info' });

  state.notifications.push(notification);
};

export const displayWarning: ActionWithParam<string> = ({ state }, message: string) => {
  const notification = createNotification({ message, type: 'warn' });

  state.notifications.push(notification);
};

export const displayError: ActionWithParam<string> = ({ state }, message: string) => {
  const notification = createNotification({ message, type: 'error' });

  state.notifications.push(notification);
};
