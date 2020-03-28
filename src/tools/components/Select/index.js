import React from 'react'
import {connect} from '@cerebral/react'
import getSize from '../../../events/computed/size'
import getStart from '../../../events/computed/start'
import inlineStyles from './inlineStyles'

/**
 * Selects highlighted shapes
 **/

// Factory function
export function rectangle({position, size}) {
  return {
    name: 'Rectangle x',
    position: position,
    size: size,
    type: 'rect'
  }
}

// Command
export function createSelection() {
  const options = {
    position: getStart().get(),
    size: getSize().get()
  }

  return rectangle(options)
}

// Pure component
export const Select = ({size, position}) => (
    <rect key="selection" style={inlineStyles} x={position.x} y={position.y} width={size.width} height={size.height} strokeDasharray="5, 5" />
)

export default connect({
    position: getStart,
    size: getSize
}, Select)