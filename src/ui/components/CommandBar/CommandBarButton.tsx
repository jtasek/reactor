import React, { FC } from 'react';
import styles from './styles.css';
import { Command } from 'src/app/types';
import { Icon } from '../Icon';
import { useActions } from 'src/app/hooks';

export interface Props {
    active: boolean;
    command: Command;
    onClick: () => void;
}

export const CommandBarButton: FC<Props> = ({ active, command, onClick }) => {
    const { canExecuteCommand, executeCommand } = useActions();
    const enabled = canExecuteCommand(command.canExecute);

    return (
        <li className={styles.commandBarButton} aria-disabled={!enabled} aria-current={active}>
            {enabled && (
                <a
                    href="#"
                    onClick={(event) => {
                        event.preventDefault();
                        onClick();
                        // executeCommand(command.execute);
                    }}
                    title={command.description}
                >
                    <Icon icon={command.icon} />
                    {command.name}
                </a>
            )}
            {!enabled && (
                <>
                    <Icon icon={command.icon} />
                    {command.name}
                </>
            )}
        </li>
    );
};
