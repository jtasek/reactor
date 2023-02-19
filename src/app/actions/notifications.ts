import { Action, NotificationType } from '../types';
import { createNotification } from '../factories';

export const displayInfo: Action = ({ state }, message: string) => {
  const notification = createNotification({ message, type: 'info' });

  state.notifications.push(notification);
};

export const displayWarning: Action = ({ state }, message: string) => {
  const notification = createNotification({ message, type: 'warn' });

  state.notifications.push(notification);
};

export const displayError: Action = ({ state }, message: string) => {
  const notification = createNotification({ message, type: 'error' });

  state.notifications.push(notification);
};
