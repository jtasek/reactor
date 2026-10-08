import React, { FC, Fragment, useState } from 'react';

import { usePlacedCommands } from 'src/app/hooks';
import type { Command } from 'src/app/types';
import { shortcutLabel, usesCommandKey } from './shortcutLabel';

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
    const commands = usePlacedCommands('commandBar');
    const [hovered, setHovered] = useState<Command>();
    const [focused, setFocused] = useState<Command>();
    const shown = hovered ?? focused;
    const description = shown?.description;
    const shortcut = shown?.shortcut;
    const groupProps = { onHover: setHovered, onFocus: setFocused };

    if (commands.length === 0) {
        return null;
    }

    const groups = Object.entries(groupCommands(commands));
    const last = groups.pop();

    if (!last || !groups) {
        return null;
    }

    return (
        <div className={styles.container} style={DOCK_GEOMETRY_STYLE}>
            <ul
                className={styles.commandBar}
                aria-label="Commands"
                onMouseLeave={() => setHovered(undefined)}
            >
                {groups.map(([key, value]) => (
                    <Fragment key={key}>
                        <CommandBarGroup commands={value} {...groupProps} />
                        <CommandBarDelimiter />
                    </Fragment>
                ))}
                <CommandBarGroup commands={last[1]} {...groupProps} />
            </ul>
            {/* Each button says its own description; this repeats it for the eye. */}
            <p className={styles.info} data-cy="command-info" aria-hidden="true">
                {description}
                {description && shortcut && (
                    <kbd className={styles.shortcut}>
                        {shortcutLabel(shortcut, usesCommandKey())}
                    </kbd>
                )}
            </p>
        </div>
    );
};
