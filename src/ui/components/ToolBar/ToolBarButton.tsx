import React, { FC } from 'react';

import styles from './styles.css';

import { Icon } from '../Icon';
import type { Tool } from 'src/tools/types';

interface Props {
    tool: Tool;
    active: boolean;
    onClick: (toolId: string) => void;
}

const toolBarIcon = (tool: Tool) => {
    if (!tool.icon) return undefined;

    // Tool metadata may color an icon; the glass bar uses one legible icon color.
    return { ...tool.icon, color: undefined };
};

export const ToolBarButton: FC<Props> = ({ tool, active, onClick }) => (
    <li className={styles.toolBarButton} data-active={active}>
        <button
            type="button"
            aria-pressed={active}
            onClick={() => onClick(tool.id)}
            title={tool.description}
        >
            <Icon icon={toolBarIcon(tool)} />
        </button>
    </li>
);
