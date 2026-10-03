import React, { useEffect } from 'react';
import styles from './Notification.css';
import { useActions, useNotifications } from '../hooks';
import type { Notification as NotificationData, NotificationType } from '../types';
import { Icon } from 'src/ui/components/Icon';

const icon = (group: string, name: string) => ({ group, name, size: 18 });

/** How each kind of notification looks: its color variant and its icon. */
const VARIANTS: Record<NotificationType, { className: string; icon: ReturnType<typeof icon> }> = {
    info: {
        className: styles.info,
        icon: icon('action', 'info')
    },
    success: {
        className: styles.success,
        icon: icon('action', 'check_circle')
    },
    warning: {
        className: styles.warning,
        icon: icon('alert', 'warning')
    },
    error: {
        className: styles.error,
        icon: icon('alert', 'error')
    }
};

const closeIcon = icon('navigation', 'close');
const NOTIFICATION_TIMEOUT = 10_000;

const NotificationItem = ({ id, type, message, link }: NotificationData) => {
    const { dismissNotification } = useActions();
    const variant = VARIANTS[type];

    useEffect(() => {
        const timeout = window.setTimeout(() => dismissNotification(id), NOTIFICATION_TIMEOUT);

        return () => window.clearTimeout(timeout);
    }, [id, dismissNotification]);

    return (
        <div
            className={`${styles.notification} ${variant.className}`}
            data-type={type}
            role={type === 'error' ? 'alert' : 'status'}
        >
            <span className={styles.icon} aria-hidden="true">
                <Icon icon={variant.icon} />
            </span>
            <span className={styles.message}>{message}</span>
            {link && (
                <a
                    className={styles.action}
                    href={link.url}
                    onClick={() => dismissNotification(id)}
                >
                    {link.label}
                </a>
            )}
            <button
                type="button"
                className={styles.dismiss}
                aria-label="Dismiss"
                title="Dismiss"
                onClick={() => dismissNotification(id)}
            >
                <Icon icon={closeIcon} />
            </button>
        </div>
    );
};

/** The notifications, newest at the bottom, each dismissed after ten seconds. */
export const Notification = () => {
    const notifications = useNotifications();

    if (notifications.length === 0) {
        return null;
    }

    return (
        <div className={styles.notifications}>
            {notifications.map((notification) => (
                <NotificationItem key={notification.id} {...notification} />
            ))}
        </div>
    );
};
