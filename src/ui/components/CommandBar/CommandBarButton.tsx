import React, { FC, useId } from 'react';
import styles from './styles.css';
import { Command } from 'src/app/types';
import { Icon } from '../Icon';
import { useActions, useCommandEnabled } from 'src/app/hooks';
import { shortcutKeys, usesCommandKey } from './shortcutLabel';

export interface Props {
    active: boolean;
    command: Command;
    onClick: () => void;
    onHover: (command: Command | undefined) => void;
    onFocus: (command: Command | undefined) => void;
}

export const CommandBarButton: FC<Props> = ({ active, command, onClick, onHover, onFocus }) => {
    const { runCommand } = useActions();
    const enabled = useCommandEnabled(command);
    const descriptionId = useId();

    return (
        <li
            className={styles.commandBarButton}
            data-disabled={!enabled}
            aria-current={active}
            onMouseEnter={() => onHover(command)}
        >
            <button
                type="button"
                disabled={!enabled}
                title={command.name}
                aria-label={command.name}
                aria-describedby={command.description ? descriptionId : undefined}
                aria-keyshortcuts={
                    command.shortcut ? shortcutKeys(command.shortcut, usesCommandKey()) : undefined
                }
                onFocus={() => onFocus(command)}
                onBlur={() => onFocus(undefined)}
                onClick={() => {
                    onClick();
                    runCommand(command);
                }}
            >
                <Icon icon={command.icon} />
            </button>
            {command.description && (
                <span id={descriptionId} hidden>
                    {command.description}
                </span>
            )}
        </li>
    );
};
