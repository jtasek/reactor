import React, { FC } from 'react';

import styles from './styles.css';

import { Icon } from '../Icon';
import { Tool } from '../../../tools/types';

interface Props {
  tool: Tool;
  onClick: (toolId: string) => void;
}

export const ToolBarButton: FC<Props> = ({ tool, onClick }) => (
  <li className={styles.toolBarButton} style={tool.active ? { opacity: '1' } : {}}>
    <a href="#" onClick={() => onClick(tool.code)} title={tool.description}>
      <Icon {...tool.icon} />
    </a>
  </li>
);
