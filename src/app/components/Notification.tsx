import React from 'react';
import styles from './Notification.css';
import { useActions, useNotifications } from '../hooks';
import type { NotificationType } from '../types';
import { Icon } from '../../ui/components/Icon';

const icon = (group: string, name: string) => ({ group, name, size: 18 });

/** How each kind of notification looks: its color variant and its icon. */
const VARIANTS: Record<NotificationType, { className: string; icon: ReturnType<typeof icon> }> = {
    info: { className: styles.info, icon: icon('action', 'info') },
    success: {
        className: styles.success,
        icon: icon('action', 'check_circle')
    },
    warning: { className: styles.warning, icon: icon('alert', 'warning') },
    error: { className: styles.error, icon: icon('alert', 'error') }
};

const closeIcon = icon('navigation', 'close');

/** The notifications, newest at the bottom, each until dismissed. */
export const Notification = () => {
    const notifications = useNotifications();
    const { dismissNotification } = useActions();

    if (notifications.length === 0) {
        return null;
    }

    return (
        <div className={styles.notifications}>
            {notifications.map((notification) => {
                const variant = VARIANTS[notification.type];

                return (
                    <div
                        key={notification.id}
                        className={`${styles.notification} ${variant.className}`}
                        data-type={notification.type}
                        role={notification.type === 'error' ? 'alert' : 'status'}
                    >
                        <span className={styles.icon} aria-hidden="true">
                            <Icon icon={variant.icon} />
                        </span>
                        <span className={styles.message}>{notification.message}</span>
                        {notification.link && (
                            <a
                                className={styles.action}
                                href={notification.link.url}
                                onClick={() => dismissNotification(notification.id)}
                            >
                                {notification.link.label}
                            </a>
                        )}
                        <button
                            type="button"
                            className={styles.dismiss}
                            aria-label="Dismiss"
                            title="Dismiss"
                            onClick={() => dismissNotification(notification.id)}
                        >
                            <Icon icon={closeIcon} />
                        </button>
                    </div>
                );
            })}
        </div>
    );
};
