import React, { FC } from 'react';
import styles from './styles.css';
import { ToolBarButton } from './ToolBarButton';
import { useAppState } from 'src/app/hooks';
import { useTools } from '../../../tools/components';

export interface Props {
  onClick: (toolId: string) => void;
}

export const ToolBar: FC<Props> = ({ onClick }) => {
  const { tools } = useAppState();
  const registeredTools = useTools();

  return (
    <ul className={styles.toolBar}>
      {registeredTools.map((item) => (
        <ToolBarButton
          key={item.id}
          tool={item}
          active={tools.activeToolsIds.includes(item.id)}
          onClick={onClick}
        />
      ))}
    </ul>
  );
};
