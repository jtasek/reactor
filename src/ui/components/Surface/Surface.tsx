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
        handleMouseWheel,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp
    } = usePointerAdapter(svgRef);

    return (
        <svg
            className={styles.surface}
            preserveAspectRatio="none"
            ref={svgRef}
            onContextMenu={handleContextMenu}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
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
