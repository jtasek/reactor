import React from 'react'
import { connect } from '@cerebral/react'
import { props, state } from 'cerebral/tags'
import getPosition from '../../../reflex/computed/getPosition'
import getSize from '../../../reflex/computed/getSize'
import styles from '../../styles.css'

/**
 * Insert image based on current coords
 * Select from library or upload to librarys
 
<image 
    x="the x-axis top-left corner of the image"
    y="the y-axis top-left corner of the image"
    width="the width of the image. Required."
    height="the height of the image. Required."
    xlink:href="the path to the image. Required." 
/>
 
 **/
export const Image = ({ position, size, imagePath }) => (
  <image key="image" style={inlineStyles} x={position.x} y={position.y} width={size.width} height={size.height} xlinkHref={imagePath} />
)

export default connect({
  position: getPosition,
  size: getSize,
  shape: state`workspace.shapes.${props`id`}`
}, Image)