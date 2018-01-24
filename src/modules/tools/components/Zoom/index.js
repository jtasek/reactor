import React from 'react'
import { connect } from '@cerebral/react'
import { props, state } from 'cerebral/tags'
import inlineStyles from '../../inlineStyles'

/**
 * Change zoom of the surface
 **/
export const Zoom = ({position}) => (
  <text key="text" style={inlineStyles} x={position.x} y={position.y}>Tohle je test string</text>
)

export default connect({
  position: state`reflex.monitor.position`
}, Zoom)