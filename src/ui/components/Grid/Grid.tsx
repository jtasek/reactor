import React, { FC } from 'react';
import { Camera, Grid as GridType } from 'src/app/types';

import styles from './styles.css';

function getGridPath(width: number, height: number, scale: number) {
  return `M ${width * scale} 0 L 0 0 0 ${height * scale}`;
}

export interface Props {
  camera: Camera;
  grid: GridType;
}

export const Grid: FC<Props> = ({ grid, camera }) => {
  const smallGridHeight = grid.height * camera.scale;
  const smallGridWidth = grid.width * camera.scale;
  const smallGridPath = getGridPath(grid.width, grid.height, camera.scale);
  const gridHeight = grid.height * grid.factor * camera.scale;
  const gridWidth = grid.width * grid.factor * camera.scale;
  const gridPath = getGridPath(grid.width * grid.factor, grid.height * grid.factor, camera.scale);
  const transform = `translate(${camera.position.x}, ${camera.position.y})`;

  return (
    <g>
      <defs>
        <pattern
          id="smallGrid"
          width={smallGridWidth}
          height={smallGridHeight}
          patternUnits="userSpaceOnUse"
        >
          <path d={smallGridPath} className={styles['grid-lines-small']} />
        </pattern>
        <pattern
          id="grid"
          width={gridWidth}
          height={gridHeight}
          patternUnits="userSpaceOnUse"
          patternTransform={transform}
        >
          <rect width={gridWidth} height={gridHeight} fill="url(#smallGrid)" />
          <path d={gridPath} className={styles['grid-lines-large']} />
        </pattern>
      </defs>
      <rect className={styles.grid} fill="url(#grid)" />
    </g>
  );
};
