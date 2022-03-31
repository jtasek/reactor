import React, { FC } from 'react';
import { Icon } from '../Icon';
import styles from './styles.css';
import { Tool } from 'src/tools/types';

export interface Props {
  tool: Tool;
  inlineStyles: any;
  onClick: (tool: string) => void;
}

export const ContextMenuItem: FC<Props> = ({ tool, inlineStyles, onClick }) => (
  <li className={styles.contextMenuButton} style={inlineStyles}>
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        onClick(tool.id);
      }}
      title={tool.description}
    >
      <Icon icon={tool.icon} />
    </a>
  </li>
);
