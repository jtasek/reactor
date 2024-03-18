import React, { FC } from 'react';
import styles from './styles.css';
import { ToolBarButton } from './ToolBarButton';
import { useActions, useTools } from 'src/app/hooks';
import { useRegisteredTools } from '../../../tools/components';

export const ToolBar: FC = () => {
    const actions = useActions();
    const { activeToolsIds } = useTools();
    const tools = useRegisteredTools();

    return (
        <ul className={styles.toolBar}>
            {tools.map((item) => (
                <ToolBarButton
                    active={activeToolsIds.includes(item.id)}
                    key={item.id}
                    onClick={() => actions.tools.activateTool(item.id)}
                    tool={item}
                />
            ))}
        </ul>
    );
};
