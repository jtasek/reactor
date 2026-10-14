import React, { lazy, Suspense, useEffect } from 'react';
import styles from './styles.css';
import { useActions, useNotifications } from '../../hooks';
import type { Notification as NotificationData, NotificationType } from '../../types';

const VARIANTS: Record<NotificationType, string> = {
    info: styles.info,
    success: styles.success,
    warning: styles.warning,
    error: styles.error
};

const IconFallback = ({ type }: { type: NotificationType | 'dismiss' }) => (
    <>{type === 'dismiss' ? 'Dismiss' : null}</>
);

// A notice stays readable and dismissible even when its decorative icons cannot load.
const NotificationIcon = lazy(() =>
    import(/* webpackChunkName: "notification-icons" */ './NotificationIcon')
        .then(({ NotificationIcon }) => ({ default: NotificationIcon }))
        .catch(() => ({ default: IconFallback }))
);

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
            className={`${styles.notification} ${variant}`}
            data-type={type}
            role={type === 'error' ? 'alert' : 'status'}
        >
            <span className={styles.icon} aria-hidden="true">
                <Suspense fallback={null}>
                    <NotificationIcon type={type} />
                </Suspense>
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
                <Suspense fallback={<IconFallback type="dismiss" />}>
                    <NotificationIcon type="dismiss" />
                </Suspense>
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
