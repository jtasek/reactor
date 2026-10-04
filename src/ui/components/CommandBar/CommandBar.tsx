import React, { FC, Fragment } from 'react';

import { useCommands } from 'src/app/hooks';
import type { Command } from 'src/app/types';

import { CommandBarDelimiter } from './CommandBarDelimiter';
import { CommandBarGroup } from './CommandBarGroup';
import styles from './styles.css';
import { DOCK_GEOMETRY_STYLE } from '../PanelLayout/geometry';

function groupCommands(commands: Command[]): Record<string, Command[]> {
    return commands.reduce(
        (result, command) => {
            if (result[command.category]) {
                result[command.category].push(command);
            } else {
                result[command.category] = [command];
            }
            return result;
        },
        {} as Record<string, Command[]>
    );
}

export const CommandBar: FC = () => {
    const commands = useCommands();

    if (commands.length === 0) {
        return null;
    }

    const groups = Object.entries(groupCommands(commands));
    const last = groups.pop();

    if (!last || !groups) {
        return null;
    }

    return (
        <ul className={styles.commandBar} style={DOCK_GEOMETRY_STYLE} aria-label="Commands">
            {groups.map(([key, value]) => (
                <Fragment key={key}>
                    <CommandBarGroup commands={value} />
                    <CommandBarDelimiter />
                </Fragment>
            ))}
            <CommandBarGroup commands={last[1]} />
        </ul>
    );
};
