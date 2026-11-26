import React, { FC } from 'react';
import styles from './styles.css';
import { ToolBarButton } from './ToolBarButton';
import { ToolBarGroup } from './ToolBarGroup';
import { useActions, useActiveToolsIds } from 'src/app/hooks';
import { toolBarSlots } from 'src/app/services/toolBarLayout';
import { useRegisteredTools } from 'src/tools/components';

export const ToolBar: FC = () => {
    const actions = useActions();
    const activeToolsIds = useActiveToolsIds();
    const activate = (toolId: string) => actions.tools.activateTool(toolId);

    return (
        <ul className={styles.toolBar} aria-label="Tools">
            {toolBarSlots(useRegisteredTools()).map((tools) =>
                tools.length > 1 ? (
                    <ToolBarGroup
                        activeToolsIds={activeToolsIds}
                        key={tools[0].id}
                        onClick={activate}
                        tools={tools}
                    />
                ) : (
                    <ToolBarButton
                        active={activeToolsIds.includes(tools[0].id)}
                        key={tools[0].id}
                        onClick={activate}
                        tool={tools[0]}
                    />
                )
            )}
        </ul>
    );
};
