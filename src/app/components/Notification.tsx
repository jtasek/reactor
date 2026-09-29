import React from 'react';
import { useActions, useAppState } from '../hooks';

/**
 * The notifications, newest at the bottom, each until dismissed: a stack in the
 * corner above the status bar, clear of the canvas and the menus.
 */
export const Notification = () => {
    const notifications = useAppState((state) => state.notifications);
    const { dismissNotification } = useActions();

    if (notifications.length === 0) {
        return null;
    }

    return (
        <div
            style={{
                position: 'fixed',
                bottom: 36,
                left: 16,
                zIndex: 10000,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                maxWidth: 'min(420px, calc(100vw - 32px))',
                // Sized by its notifications, not the page size site.css gives `#app > div`.
                width: 'auto',
                height: 'auto',
                overflow: 'visible'
            }}
        >
            {notifications.map((notification) => (
                <div
                    key={notification.id}
                    role={notification.type === 'error' ? 'alert' : 'status'}
                    style={{
                        display: 'flex',
                        gap: 12,
                        alignItems: 'baseline',
                        padding: 12,
                        borderRadius: 6,
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                        background: '#fff3cd',
                        color: '#332701'
                    }}
                >
                    <span style={{ flex: 1 }}>
                        {notification.message}
                        {notification.link && (
                            <>
                                {' '}
                                <a
                                    href={notification.link.url}
                                    onClick={() => dismissNotification(notification.id)}
                                >
                                    {notification.link.label}
                                </a>
                            </>
                        )}
                    </span>
                    <button type="button" onClick={() => dismissNotification(notification.id)}>
                        Dismiss
                    </button>
                </div>
            ))}
        </div>
    );
};
