import React, { FC } from 'react';

import { useCommands } from 'src/app/hooks';
import { Command } from 'src/app/types';

import { CommandBarDelimiter } from './CommandBarDelimiter';
import { CommandBarGroup } from './CommandBarGroup';
import styles from './styles.css';

function groupCommands(commands): Record<string, Command[]> {
  if (commands?.length === 0) {
    return {};
  }

  return commands.reduce((result, command) => {
    if (result[command.category]) {
      result[command.category].push(command);
    } else {
      result[command.category] = [command];
    }
    return result;
  }, {});
}

export const CommandBar: FC = () => {
  const commands = useCommands();

  if (commands?.length === 0) {
    return null;
  }

  const groups = groupCommands(commands);

  return (
    <ul className={styles.commandBar}>
      {Object.entries(groups).map(([key, value]) => (
        <>
          <CommandBarDelimiter />
          <CommandBarGroup key={key} commands={value} />
        </>
      ))}
    </ul>
  );
};
