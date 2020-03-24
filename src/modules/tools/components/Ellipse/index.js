import React from 'react'
import { connect } from '@cerebral/react'
import { props, state } from 'cerebral'
import getCentre from '../../../reflex/computed/getCentre'
import getSize from '../../../reflex/computed/getSize'
import styles from '../../styles.css'

/**
 * Draws an ellipse based on input coords and size

<ellipse 
    cx="the x-axis center of the ellipse"
    cy="the y-axis center of the ellipse"
    rx="the length of the ellipse's radius along the x-axis. Required."
    ry="the length of the ellipse's radius along the y-axis. Required." 
/>
**/

export const Ellipse = ({ centre, size, selected }) => {
  let className = selected
    ? styles.shape + ' ' + styles.selected
    : styles.shape

  return (
    <ellipse
      key="circle"
      className={className}
      cx={centre.x}
      cy={centre.y}
      rx={size.width}
      ry={size.height}
    />
  )
}

export default connect(
  {
    centre: getCentre(),
    size: getSize(),
    shape: state`workspace.shapes.${props`id`}`
  },
  Ellipse
)
