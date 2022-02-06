import React, { FC } from 'react';
import { Icon } from '../Icon';
import { useCommand } from 'src/app/hooks';
import styles from './styles.css';

export interface Props {
  commandId: string;
}

export const CommandBarButton: FC<Props> = ({ commandId }) => {
  const command = useCommand(commandId);

  return (
    <li className={styles.commandBarButton}>
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          alert(command.id);
        }}
        title={command.description}
      >
        <Icon icon={command.icon} />
        {command.canExecute ? '' : '*'}
        {command.name}
      </a>
    </li>
  );
};
