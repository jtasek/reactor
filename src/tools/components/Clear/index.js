import React from 'react'
import { connect } from '@cerebral/react'
import getCentre from '../../../events/computed/getCentre'
import getRadius from '../../../events/computed/getRadius'
import inlineStyles from '../../inlineStyles'

/**
 * Draw ellipse based on input coords
**/
// Clone current selection
// Clone shape or shapes
export const Clone = ({ centre, radius }) => (
  <circle key="circle" style={inlineStyles} cx={centre.x} cy={centre.y} r={radius} />
)

export default connect({
  centre: getCentre,
  radius: getRadius
}, Clone)