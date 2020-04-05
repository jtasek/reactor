import React, { FC } from 'react';
import styles from './styles.css';
import { useApp } from '../../../app';
import { Camera, Grid } from '../../../app/types';

function getGridPath(width: number, height: number, scale: number) {
  return `M ${width * scale} 0 L 0 0 0 ${height * scale}`;
}

interface Props {
  camera: Camera;
  grid: Grid;
}

const Grid: FC<Props> = ({ grid, camera }) => {
  const smallGridHeight = grid.height * camera.scale;
  const smallGridWidth = grid.width * camera.scale;
  const smallGridPath = getGridPath(grid.width, grid.height, camera.scale);
  const gridHeight = grid.height * grid.factor * camera.scale;
  const gridWidth = grid.width * grid.factor * camera.scale;
  const gridPath = getGridPath(grid.width * grid.factor, grid.height * grid.factor, camera.scale);
  const transform = `translate(${camera.position.x}, ${camera.position.y})`;

  return (
    <g
      style={!grid.visible ? { display: 'none' } : { display: 'block' }}
      width="100%"
      height="100%"
    >
      <defs>
        <pattern
          id="smallGrid"
          width={smallGridWidth}
          height={smallGridHeight}
          patternUnits="userSpaceOnUse"
        >
          <path d={smallGridPath} stroke="gray" strokeWidth="0.5" fill="none" />
        </pattern>
        <pattern
          id="grid"
          width={gridWidth}
          height={gridHeight}
          patternUnits="userSpaceOnUse"
          patternTransform={transform}
        >
          <rect width={gridWidth} height={gridHeight} fill="url(#smallGrid)" />
          <path d={gridPath} stroke="gray" strokeWidth="1" fill="none" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </g>
  );
};

export default () => {
  const { state } = useApp();

  const camera = state.currentDocument?.camera;
  const grid = state.ui.controls.grid;

  return <Grid camera={camera} grid={grid} />;
};
