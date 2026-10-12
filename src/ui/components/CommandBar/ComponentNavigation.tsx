import React, { FC } from 'react';
import { useActions, useCommandEnabled } from 'src/app/hooks';
import { useEditingComponentName } from 'src/app/componentHooks';
import { LeaveComponentSourceCommand } from 'src/commands/component';
import { Icon } from '../Icon';
import styles from './styles.css';

export const ComponentNavigation: FC = () => {
    const name = useEditingComponentName();
    const enabled = useCommandEnabled(LeaveComponentSourceCommand);
    const { runCommand } = useActions();
    const handleBack = () => runCommand(LeaveComponentSourceCommand);

    if (!name) {
        return null;
    }

    return (
        <nav className={styles.componentNavigation} aria-label="Component editing">
            <button
                type="button"
                onClick={handleBack}
                disabled={!enabled}
                aria-keyshortcuts="Escape"
            >
                <Icon icon={{ group: 'navigation', name: 'arrow_back', size: 16 }} />
                Back to canvas
            </button>
            <span aria-hidden="true">/</span>
            <span className={styles.componentName} aria-current="page" title={name}>
                <Icon icon={{ group: 'reactor', name: 'component', size: 16 }} />
                <span>{name}</span>
            </span>
        </nav>
    );
};
