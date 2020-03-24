import React from 'react'
import { connect } from '@cerebral/react'
import { props, state } from 'cerebral'
import currentPosition from '../../../reflex/computed/getPosition'
import startPosition from '../../../reflex/computed/getInitialPosition'
import styles from '../../styles.css'

/**
 * Draws a line from point start to end
 **/

// Command
export function line({ start, end }) {
  return {
    name: 'Line x',
    start: start,
    end: end,
    selected: true,
    type: 'line'
  }
}

// Factory function
export function createLine() {
  const options = {
    start: startPosition().get(),
    end: currentPosition().get()
  }

  return line(options)
}

// Pure component
export const Line = ({ start, end, selected }) => {
  let className = selected
    ? styles.shape + ' ' + styles.selected
    : styles.shape

  return (
    <line
      key="line"
      className={className}
      x1={start.x}
      y1={start.y}
      x2={end.x}
      y2={end.y}
    />
  )
}

// Connected component
export default connect(
  {
    start: startPosition,
    end: currentPosition,
    shape: state`workspace.shapes.${props`id`}`
  },
  Line
)
