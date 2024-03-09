import React, { FC, ReactNode } from 'react';
import { Point } from 'src/app/types';

import styles from './styles.css';
import { ContextMenuItems } from './ContextMenuItems';
import { usePointer } from 'src/app/hooks';
import { useRegisteredTools } from '../../../tools/components';

export interface Props {
    position: Point;
    children?: ReactNode;
}

export const ContextMenu: FC<Props> = ({ position, children }) => (
    <ul
        className={styles.contextMenu}
        style={{
            position: 'absolute',
            top: position.y,
            left: position.x
        }}
    >
        {children}
    </ul>
);

export const ConnectedContextMenu: FC = () => {
    const { start } = usePointer();
    const tools = useRegisteredTools();

    return (
        <ContextMenu position={start}>
            <ContextMenuItems items={tools} />
        </ContextMenu>
    );
};
