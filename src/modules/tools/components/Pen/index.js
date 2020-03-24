import React from 'react'
import { connect } from '@cerebral/react'
import { props, state } from 'cerebral'
import getPath from '../../../reflex/computed/getPath'
import styles from '../../styles.css'

/** 
 * Draws a line based on path
 
 <polyline points="the points on the polyline. Required." />
  
**/

// Command
export function pen({ path }) {
  return {
    name: 'Pen x',
    path: path,
    selected: true,
    type: 'pen'
  }
}

// Factory function
export function createPen() {
  const options = {
    path: getPath()
  }

  return pen(options)
}

// Pure component
export const Pen = ({ path, selected }) => {
  let className = selected
    ? styles.shape + ' ' + styles.selected
    : styles.shape

  return <polyline key="line" className={className} points={path} />
}

// Connected component
export default connect(
  {
    path: getPath,
    shape: state`workspace.shapes.${props`id`}`
  },
  Pen
)
