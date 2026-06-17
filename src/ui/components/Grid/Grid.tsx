import React, { FC } from 'react';
import { Camera, Grid as GridType } from 'src/app/types';

import styles from './styles.css';

function getGridPath(width: number, height: number, scale: number) {
    return `M ${width * scale} 0 L 0 0 0 ${height * scale}`;
}

export interface Props {
    id: string;
    camera: Camera;
    grid: GridType;
}

export const Grid: FC<Props> = ({ id, grid, camera }) => {
    const smallGridHeight = grid.height * camera.scale;
    const smallGridWidth = grid.width * camera.scale;
    const smallGridPath = getGridPath(grid.width, grid.height, camera.scale);
    const gridHeight = grid.height * grid.factor * camera.scale;
    const gridWidth = grid.width * grid.factor * camera.scale;
    const gridPath = getGridPath(grid.width * grid.factor, grid.height * grid.factor, camera.scale);
    const transform = `translate(${camera.position.x}, ${camera.position.y})`;

    // Pattern ids must be unique per instance: the main canvas and the minimap
    // both render a grid in the same document, and a duplicate id would make one
    // `url(#…)` reference resolve to the other instance's pattern — so panning
    // the live-camera canvas would drag the static minimap grid.
    const smallGridId = `${id}-small`;
    const gridId = `${id}-grid`;

    return (
        <g>
            <defs>
                <pattern
                    id={smallGridId}
                    width={smallGridWidth}
                    height={smallGridHeight}
                    patternUnits="userSpaceOnUse"
                >
                    <path d={smallGridPath} className={styles['grid-lines-small']} />
                </pattern>
                <pattern
                    id={gridId}
                    width={gridWidth}
                    height={gridHeight}
                    patternUnits="userSpaceOnUse"
                    patternTransform={transform}
                >
                    <rect width={gridWidth} height={gridHeight} fill={`url(#${smallGridId})`} />
                    <path d={gridPath} className={styles['grid-lines-large']} />
                </pattern>
            </defs>
            <rect className={styles.grid} fill={`url(#${gridId})`} />
        </g>
    );
};
