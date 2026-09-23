import React, { FC, ReactNode } from 'react';
import { usePointerAdapter } from '../../../events/drivers/usePointerAdapter';

import styles from './styles.css';

interface Props {
    children?: ReactNode;
}

export const Surface: FC<Props> = ({ children }) => {
    const svgRef = React.useRef<SVGSVGElement>(null);

    const {
        handleContextMenu,
        handleLostPointerCapture,
        handleMouseWheel,
        handlePointerCancel,
        handlePointerDown,
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
            onLostPointerCapture={handleLostPointerCapture}
            onPointerCancel={handlePointerCancel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onTouchCancel={handleTouchCancel}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onTouchStart={handleTouchStart}
            onWheel={handleMouseWheel}
            style={{
                touchAction: 'none', // 🔑 prevents native pinch zoom / scrolling
                userSelect: 'none'
            }}
        >
            {children}
        </svg>
    );
};
