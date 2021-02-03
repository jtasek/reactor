import React, { FC } from 'react';

import styles from './styles.css';

import { Icon } from '../Icon';
import type { Tool } from '../../../tools/types';

interface Props {
  tool: Tool;
  active: boolean;
  onClick: (toolId: string) => void;
}

export const ToolBarButton: FC<Props> = ({ tool, active, onClick }) => (
  <li className={styles.toolBarButton} style={active ? { opacity: '1' } : {}}>
    <a href="#" onClick={() => onClick(tool.code)} title={tool.description}>
      <Icon icon={tool.icon} />
    </a>
  </li>
);
