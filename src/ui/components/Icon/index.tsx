import React, { FC } from 'react';
import type { Icon as IconType } from 'src/app/types';

export interface Props {
    icon?: IconType;
}

const ICON_STROKE_WIDTH = 1.5;

export const Icon: FC<Props> = ({ icon }) => {
    if (!icon) {
        return null;
    }

    const Component = icon.component;

    return (
        <Component
            aria-hidden="true"
            focusable="false"
            size={icon.size}
            color={icon.color}
            fill={icon.fill ?? 'none'}
            strokeWidth={ICON_STROKE_WIDTH}
        />
    );
};
