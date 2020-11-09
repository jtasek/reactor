import React, { FC } from 'react';
import styles from './styles.css';
import { ToolBarButton } from './ToolBarButton';
import { Tool } from 'src/tools/types';

export interface Props {
  tools: Tool[];
  onClick: (toolId: string) => void;
}

export const ToolBar: FC<Props> = ({ tools, onClick }) => (
  <ul className={styles.toolBar}>
    {Object.entries(tools).map(([name, tool]) => (
      <ToolBarButton key={name} tool={tool} onClick={onClick} />
    ))}
  </ul>
);
