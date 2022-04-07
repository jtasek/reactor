import React, { FC } from 'react';

import { Command } from 'src/app/types';

import { CommandBarButton } from './CommandBarButton';

export const CommandBarDelimiter: FC = () => <li>|</li>;

export interface Props {
  commands: Command[];
}

export const CommandBarGroup: FC<Props> = ({ commands }) => {
  return (
    <>
      {commands.map((command) => (
        <CommandBarButton key={command.id} command={command} />
      ))}
    </>
  );
};
