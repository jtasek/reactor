import React, { FC } from 'react';
import styles from './styles.css';
import { ToolBarButton } from './ToolBarButton';
import { useTools } from 'src/app/hooks';
import { useRegisteredTools } from '../../../tools/components';

export interface Props {
    onClick: (toolId: string) => void;
}

export const ToolBar: FC<Props> = ({ onClick }) => {
    const { activeToolsIds } = useTools();
    const registeredTools = useRegisteredTools();

    return (
        <ul className={styles.toolBar}>
            {registeredTools.map((item) => (
                <ToolBarButton
                    active={activeToolsIds.includes(item.id)}
                    key={item.id}
                    onClick={onClick}
                    tool={item}
                />
            ))}
        </ul>
    );
};
