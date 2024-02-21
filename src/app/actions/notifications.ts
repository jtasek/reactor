import { Action } from '../types';
import { createNotification } from '../factories';

export const displayInfo: Action<string> = ({ state }, message) => {
  const notification = createNotification({ message, type: 'info' });

  state.notifications.push(notification);
};

export const displayWarning: Action<string> = ({ state }, message: string) => {
  const notification = createNotification({ message, type: 'warn' });

  state.notifications.push(notification);
};

export const displayError: Action<string> = ({ state }, message: string) => {
  const notification = createNotification({ message, type: 'error' });

  state.notifications.push(notification);
};
