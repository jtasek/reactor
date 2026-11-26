import React, { FC, ReactNode } from 'react';

import styles from './styles.css';

import { Icon } from '../Icon';
import type { Tool } from 'src/tools/types';

interface Props {
    tool: Tool;
    active: boolean;
    onClick: (toolId: string) => void;
    /** Shown after the button, in the same slot. */
    children?: ReactNode;
}

export const toolBarIcon = (tool: Tool) => {
    if (!tool.icon) return undefined;

    // Tool metadata may color an icon; the glass bar uses one legible icon color.
    return { ...tool.icon, color: undefined };
};

export const ToolBarButton: FC<Props> = ({ tool, active, onClick, children }) => (
    <li className={styles.toolBarButton} data-active={active} data-group={!!children || undefined}>
        <button
            type="button"
            aria-pressed={active}
            onClick={() => onClick(tool.id)}
            title={tool.description}
        >
            <Icon icon={toolBarIcon(tool)} />
        </button>
        {children}
    </li>
);
