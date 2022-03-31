import React, { FC } from 'react';
import { useCommands } from 'src/app/hooks';
import { CommandBarButton } from './CommandBarButton';
import styles from './styles.css';

export const CommandBar: FC = () => {
  const commands = useCommands();

  if (Object.keys(commands)?.length === 0) {
    return null;
  } 

  return (
    <ul className={styles.commandBar}>
      {Object.values(commands).map((command) => (
        <CommandBarButton key={command.id} command={command} />
      ))}
    </ul>
  );
};
