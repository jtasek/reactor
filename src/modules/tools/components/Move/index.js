import React from 'react'
import { connect } from '@cerebral/react'
import currentPosition from '../../../reflex/computed/getPosition'
import startPosition from '../../../reflex/computed/getInitialPosition'
import styles from '../../styles.css'

/** 
 * Move selected object to new coords
 **/
export const Move = ({start, end}) => (
  <line key="line" style={inlineStyles} x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
)

export default connect({
  start: startPosition,
  end: currentPosition
}, Move)