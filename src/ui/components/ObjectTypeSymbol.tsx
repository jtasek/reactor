import React, { FC, ReactNode } from 'react';
import type { Shape } from 'src/app/types';

export type ObjectType = Shape['type'] | 'group' | 'layer' | 'surface' | 'component';

const GLYPHS: Record<ObjectType, ReactNode> = {
    rectangle: <rect x="3" y="5" width="18" height="14" rx="1" />,
    circle: <circle cx="12" cy="12" r="8" />,
    ellipse: <ellipse cx="12" cy="12" rx="9" ry="6" />,
    line: <path d="M4 19 20 5" />,
    pen: <path d="M3 18c5-14 9 8 18-12" />,
    text: <path d="M4 5h16M12 5v14M8 19h8" />,
    image: (
        <>
            <rect x="3" y="4" width="18" height="16" rx="1" />
            <circle cx="8" cy="9" r="1.5" />
            <path d="m4 17 5-5 3 3 3-3 5 5" />
        </>
    ),
    group: (
        <>
            <rect x="3" y="3" width="12" height="12" rx="1" />
            <rect x="9" y="9" width="12" height="12" rx="1" />
        </>
    ),
    layer: <path d="m12 3 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5M3 17l9 5 9-5" />,
    surface: <path d="m12 3 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5M3 17l9 5 9-5" />,
    component: (
        <path d="m12 2 4 4-4 4-4-4 4-4ZM6 8l4 4-4 4-4-4 4-4Zm12 0 4 4-4 4-4-4 4-4Zm-6 6 4 4-4 4-4-4 4-4Z" />
    ),
    instance: <path d="m12 2 10 10-10 10L2 12 12 2Zm0 3L5 12l7 7 7-7-7-7Z" />
};

export const ObjectTypeSymbol: FC<{ type: ObjectType; size?: number }> = ({ type, size = 16 }) => (
    <svg
        aria-hidden="true"
        data-object-type={type}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        {GLYPHS[type]}
    </svg>
);
