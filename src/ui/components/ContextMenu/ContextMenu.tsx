import React, { FC, ReactNode, useEffect, useRef } from 'react';
import { Point } from 'src/app/types';

import styles from './styles.css';
import { ContextMenuItems } from './ContextMenuItems';
import { useActions, useControls } from 'src/app/hooks';
import { useRegisteredTools } from '../../../tools/components';

export interface Props {
    position: Point;
    /** Called for a press anywhere but on the menu's items. */
    onPressOutside?: () => void;
    children?: ReactNode;
}

export const ContextMenu: FC<Props> = ({ position, onPressOutside, children }) => {
    const menu = useRef<HTMLUListElement>(null);

    useEffect(() => {
        if (!onPressOutside) {
            return;
        }

        const handlePointerDown = (event: PointerEvent) => {
            // The menu's own box is mostly empty space around its items, which is outside too.
            if (
                event.target instanceof Node &&
                event.target !== menu.current &&
                menu.current?.contains(event.target)
            ) {
                return;
            }

            // The press only closes the menu: it does not also draw or select.
            event.stopPropagation();
            onPressOutside();
        };

        document.addEventListener('pointerdown', handlePointerDown, true);

        return () => document.removeEventListener('pointerdown', handlePointerDown, true);
    }, [onPressOutside]);

    return (
        <ul
            ref={menu}
            data-cy="context-menu"
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
};

export const ConnectedContextMenu: FC = () => {
    const { contextMenu } = useControls();
    const { hideContextMenu } = useActions().ui;
    const tools = useRegisteredTools();

    return (
        <ContextMenu position={contextMenu.position} onPressOutside={hideContextMenu}>
            <ContextMenuItems items={tools} />
        </ContextMenu>
    );
};
