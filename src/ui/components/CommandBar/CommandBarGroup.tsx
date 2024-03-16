import React, { FC, useState } from 'react';

import { Command } from 'src/app/types';

import { CommandBarButton } from './CommandBarButton';

export const CommandBarDelimiter: FC = () => <li>|</li>;

export interface Props {
    commands: Command[];
}

export const CommandBarGroup: FC<Props> = ({ commands }) => {
    const [activeCommand, setActiveCommand] = useState<string>();

    return (
        <>
            {commands.map((command) => (
                <CommandBarButton
                    active={command.id === activeCommand}
                    command={command}
                    key={command.id}
                    onClick={() => setActiveCommand(command.id)}
                />
            ))}
        </>
    );
};
