import React, { FC } from 'react';
import styles from './styles.css';
import { ToolBarButton } from './ToolBarButton';
import { useActions, useActiveToolsIds, useCommandEnabled } from 'src/app/hooks';
import { useRegisteredTools } from 'src/tools/components';
import { ResetDocumentCommand } from 'src/commands/document';
import { Icon } from '../Icon';

export const ToolBar: FC = () => {
    const actions = useActions();
    const activeToolsIds = useActiveToolsIds();
    const tools = useRegisteredTools();
    const resetEnabled = useCommandEnabled(ResetDocumentCommand);

    return (
        <ul className={styles.toolBar} aria-label="Tools">
            {tools.map((item) => (
                <ToolBarButton
                    active={activeToolsIds.includes(item.id)}
                    key={item.id}
                    onClick={() => actions.tools.activateTool(item.id)}
                    tool={item}
                />
            ))}
            <li className={styles.toolBarButton}>
                <button
                    type="button"
                    title={ResetDocumentCommand.name}
                    disabled={!resetEnabled}
                    onClick={() => actions.runCommand(ResetDocumentCommand)}
                >
                    <Icon icon={ResetDocumentCommand.icon} />
                </button>
            </li>
        </ul>
    );
};
