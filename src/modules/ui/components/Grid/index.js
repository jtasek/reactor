// @flow 
import React, { Component } from 'react'
import { connect } from '@cerebral/react'
import { state } from 'cerebral/tags'
import styles from './styles.css'

function getGridPath(width, height, scale) {
  return `M ${width * scale} 0 L 0 0 0 ${height * scale}`
}

const Grid = ({ grid, camera }) => (
  <g style={!grid.visible ? { display: 'none' } : { display: 'block' }} width="100%" height="100%">
    <defs>
      <pattern
        id="smallGrid"
        width={grid.width * camera.scale}
        height={grid.height * camera.scale}
        patternUnits="userSpaceOnUse">
        <path d={getGridPath(grid.width, grid.height, camera.scale)} stroke="gray" strokeWidth="0.5" fill="none" />
      </pattern>
      <pattern
        id="grid"
        width={grid.width * grid.factor * camera.scale}
        height={grid.height * grid.factor * camera.scale}
        patternUnits="userSpaceOnUse"
        patternTransform={`translate(${camera.position.x}, ${camera.position.y})`}>
        <rect width={grid.width * grid.factor * camera.scale} height={grid.height * grid.factor * camera.scale} fill="url(#smallGrid)" />
        <path d={getGridPath(grid.width * grid.factor, grid.height * grid.factor, camera.scale)} stroke="gray" strokeWidth="1" fill="none" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid)" />
  </g>
)

export default connect({
  camera: state`workspace.camera`,
  grid: state`ui.controls.grid`
}, Grid)