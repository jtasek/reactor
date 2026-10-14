import React from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import type { Icon as IconType, NotificationType } from '../../types';
import { Icon } from 'src/ui/components/Icon';

const ICON_SIZE = 18;
const ICONS: Record<NotificationType | 'dismiss', IconType> = {
    info: { component: Info, size: ICON_SIZE },
    success: { component: CircleCheck, size: ICON_SIZE },
    warning: { component: TriangleAlert, size: ICON_SIZE },
    error: { component: CircleAlert, size: ICON_SIZE },
    dismiss: { component: X, size: ICON_SIZE }
};

export const NotificationIcon = ({ type }: { type: NotificationType | 'dismiss' }) => (
    <Icon icon={ICONS[type]} />
);
