import { Action } from 'overmind';
import { NotificationType } from '../types';
import { createNotification } from '../factories';

export const displayInfo: Action<string> = ({ state }, message) => {
  const notification = createNotification({ message, type: NotificationType.Info });

  state.notifications.push(notification);
};

export const displayWarning: Action<string> = ({ state }, message) => {
  const notification = createNotification({ message, type: NotificationType.Warn });

  state.notifications.push(notification);
};

export const displayError: Action<string> = ({ state }, message) => {
  const notification = createNotification({ message, type: NotificationType.Error });

  state.notifications.push(notification);
};
