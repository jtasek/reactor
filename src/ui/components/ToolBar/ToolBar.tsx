import React, { FC } from 'react';
import styles from './styles.css';
import { ToolBarButton } from './ToolBarButton';
import { useState } from 'src/app/hooks';
import { useTools } from '../../../tools/components';

export interface Props {
  onClick: (toolId: string) => void;
}

export const ToolBar: FC<Props> = ({ onClick }) => {
  const { tools } = useState();
  const registeredTools = useTools();

  return (
    <ul className={styles.toolBar}>
      {registeredTools.map((item) => (
        <ToolBarButton
          key={item.code}
          tool={item}
          active={tools.activeToolsIds.includes(item.code)}
          onClick={onClick}
        />
      ))}
    </ul>
  );
};