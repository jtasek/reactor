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

  const groups: [string, Command[]][] = Object.entries(groupCommands(commands));
  const last = groups.pop();

  if (!last || !groups) {
    return null;
  }

  return (
    <ul className={styles.commandBar}>
      {groups.map(([key, value]) => (
        <>
          <CommandBarGroup commands={value} />
          <CommandBarDelimiter />
        </>
      ))}
      <CommandBarGroup commands={last[1]} />
    </ul>
  );
};
