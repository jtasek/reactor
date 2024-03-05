import React, { FC, ReactNode } from 'react';

import { usePointerDriver } from 'src/events/drivers/usePointerDriver';

import styles from './styles.css';

interface Props {
    children?: ReactNode;
}
export const Surface: FC<Props> = ({ children }) => {
    const {
        handleContextMenu,
        handleMouseWheel,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        handleTouchEnd,
        handleTouchMove,
        handleTouchStart
    } = usePointerDriver();

    return (
        <svg
            className={styles.surface}
            preserveAspectRatio="none"
            // mouse
            onContextMenu={handleContextMenu}
            onPointerDown={handlePointerDown}
            // onPointerEnter={handlePointerDown}
            // onPointerLeave={handlePointerUp}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onTouchStart={handleTouchStart}
            onWheel={handleMouseWheel}
        >
            {children}
        </svg>
    );
};
