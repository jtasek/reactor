import React, { FC, useState } from 'react';

import { Command } from 'src/app/types';

import { CommandBarButton } from './CommandBarButton';

export interface Props {
    commands: Command[];
    onHover: (command: Command | undefined) => void;
    onFocus: (command: Command | undefined) => void;
}

export const CommandBarGroup: FC<Props> = ({ commands, onHover, onFocus }) => {
    const [activeCommand, setActiveCommand] = useState<string>();

    return (
        <>
            {commands.map((command) => (
                <CommandBarButton
                    active={command.id === activeCommand}
                    command={command}
                    key={command.id}
                    onHover={onHover}
                    onFocus={onFocus}
                    onClick={() => setActiveCommand(command.id)}
                />
            ))}
        </>
    );
};
