import React, { FC } from 'react';
import styles from './styles.css';
import { Command } from 'src/app/types';
import { Icon } from '../Icon';
import { useActions, useCommandEnabled } from 'src/app/hooks';

export interface Props {
    active: boolean;
    command: Command;
    onClick: () => void;
}

export const CommandBarButton: FC<Props> = ({ active, command, onClick }) => {
    const { runCommand } = useActions();
    const enabled = useCommandEnabled(command);

    return (
        <li className={styles.commandBarButton} data-disabled={!enabled} aria-current={active}>
            <button
                type="button"
                disabled={!enabled}
                title={command.description}
                onClick={() => {
                    onClick();
                    runCommand(command);
                }}
            >
                <Icon icon={command.icon} />
                {command.name}
            </button>
        </li>
    );
};
