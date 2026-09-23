import React from 'react';
import { useAppState } from '../hooks';

export const Notification = () => {
    const notifications = useAppState((state) => state.notifications);
    const latest = notifications[notifications.length - 1];

    if (!latest) {
        return null;
    }

    return (
        <div
            role="alert"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 10000,
                padding: 12,
                background: '#fff3cd',
                color: '#332701'
            }}
        >
            {latest.message}
        </div>
    );
};
