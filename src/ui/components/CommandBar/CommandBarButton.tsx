import React, { FC } from 'react';
import { Icon } from '../Icon';
import styles from './styles.css';
import { Command } from 'src/app/types';
import { useActions } from 'src/app/hooks';

export interface Props {
  command: Command;
}

export const CommandBarButton: FC<Props> = ({ command }) => {
  const { canExecuteCommand, executeCommand } = useActions();
  
  return (
    <li className={styles.commandBarButton}>
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          executeCommand(command.execute)
        }}
        title={command.description}
      >
        <Icon icon={command.icon} />
        {canExecuteCommand(command.canExecute) ? '' : '*'}
        {command.name}
      </a>
    </li>
  );
};
