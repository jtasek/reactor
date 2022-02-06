import React, { FC } from 'react';
import { useAppState } from 'src/app/hooks';
import { CommandBarButton } from './CommandBarItem';
import styles from './styles.css';

export const CommandBar: FC = () => {
  const commandsIds = useAppState((state) => state.commandsIds);

  if (commandsIds?.length === 0) {
    return null;
  }

  return (
    <ul
      className={styles.commandBar}
      style={{
        position: 'absolute',
        top: '10px',
        left: '600px'
      }}
    >
      {commandsIds.map((commandId) => (
        <CommandBarButton key={commandId} commandId={commandId} />
      ))}
    </ul>
  );
};
