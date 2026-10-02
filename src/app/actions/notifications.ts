import { ActionWithParam, NotificationType, SaveStatus } from '../types';
import { createNotification } from '../factories';

export const displayInfo: ActionWithParam<string> = ({ state }, message) => {
    const notification = createNotification({ message, type: NotificationType.Info });

    state.notifications.push(notification);
};

export const displaySuccess: ActionWithParam<string> = ({ state }, message) => {
    const notification = createNotification({ message, type: NotificationType.Success });

    state.notifications.push(notification);
};

export const displayWarning: ActionWithParam<string> = ({ state }, message: string) => {
    const notification = createNotification({ message, type: NotificationType.Warning });

    state.notifications.push(notification);
};

export const displayError: ActionWithParam<string> = ({ state }, message: string) => {
    const notification = createNotification({ message, type: NotificationType.Error });

    state.notifications.push(notification);
};

export const dismissNotification: ActionWithParam<string> = ({ state }, id) => {
    state.notifications = state.notifications.filter((notification) => notification.id !== id);
};

export const dismissNotifications: ActionWithParam<string> = ({ state }, message) => {
    state.notifications = state.notifications.filter(
        (notification) => notification.message !== message
    );
};

export const setSaveStatus: ActionWithParam<SaveStatus> = ({ state }, status) => {
    const current = state.saveStatus;

    if (
        current.kind !== status.kind ||
        (current.kind === 'notSaving' &&
            status.kind === 'notSaving' &&
            current.reason !== status.reason)
    ) {
        state.saveStatus = status;
    }
};
