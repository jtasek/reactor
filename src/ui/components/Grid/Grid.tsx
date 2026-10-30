import React, { FC } from 'react';
import { Camera, Grid as GridType } from 'src/app/types';

import styles from './styles.css';

/**
 * A grid tile's path: one line across its middle each way. Lines sit in the
 * middle so each is drawn whole and centred on its canvas position, as the
 * rulers' marks and the guides are. A line along a tile's edge would lose the
 * half of its stroke outside the tile and look shifted off its position.
 */
function getGridPath(width: number, height: number) {
    return `M ${width / 2} 0 V ${height} M 0 ${height / 2} H ${width}`;
}

export interface Props {
    id: string;
    camera: Camera;
    grid: GridType;
}

export const Grid: FC<Props> = ({ id, grid, camera }) => {
    const smallGridHeight = grid.height * camera.scale;
    const smallGridWidth = grid.width * camera.scale;
    const smallGridPath = getGridPath(smallGridWidth, smallGridHeight);
    const gridHeight = grid.height * grid.factor * camera.scale;
    const gridWidth = grid.width * grid.factor * camera.scale;
    const gridPath = getGridPath(gridWidth, gridHeight);
    // The large tiles start half a tile before canvas 0, so their middle lines
    // land on canvas 0 and every large step from it.
    const transform = `translate(${camera.position.x - gridWidth / 2}, ${camera.position.y - gridHeight / 2})`;

    // Pattern ids must be unique per instance: the main canvas and the minimap
    // both render a grid in the same document, and a duplicate id would make one
    // `url(#…)` reference resolve to the other instance's pattern — so panning
    // the live-camera canvas would drag the static minimap grid.
    const smallGridId = `${id}-small`;
    const gridId = `${id}-grid`;

    return (
        <g>
            <defs>
                {/* Offset so the small lines meet the large tile's middle lines too. */}
                <pattern
                    id={smallGridId}
                    x={(gridWidth - smallGridWidth) / 2}
                    y={(gridHeight - smallGridHeight) / 2}
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
