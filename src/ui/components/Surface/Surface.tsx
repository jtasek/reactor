import React, { FC, ReactNode } from 'react';
import { usePointerAdapter } from 'src/events/drivers/usePointerAdapter';

import styles from './styles.css';

interface Props {
    children?: ReactNode;
}

export const Surface: FC<Props> = ({ children }) => {
    const svgRef = React.useRef<SVGSVGElement>(null);

    const {
        handleContextMenu,
        handleDoubleClick,
        handleLostPointerCapture,
        handlePointerCancel,
        handlePointerDown,
        handlePointerLeave,
        handlePointerMove,
        handlePointerUp,
        handleTouchCancel,
        handleTouchEnd,
        handleTouchMove,
        handleTouchStart
    } = usePointerAdapter(svgRef);

    return (
        <svg
            id="surface"
            className={styles.surface}
            preserveAspectRatio="none"
            ref={svgRef}
            onContextMenu={handleContextMenu}
            onDoubleClick={handleDoubleClick}
            onLostPointerCapture={handleLostPointerCapture}
            onPointerCancel={handlePointerCancel}
            onPointerDown={handlePointerDown}
            onPointerLeave={handlePointerLeave}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onTouchCancel={handleTouchCancel}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onTouchStart={handleTouchStart}
            style={{
                touchAction: 'none', // 🔑 prevents native pinch zoom / scrolling
                userSelect: 'none'
            }}
        >
            {children}
        </svg>
    );
};
