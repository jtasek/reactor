import React, { Component } from 'react'
import styles from './styles.css'
import { connect } from '@cerebral/react'
import { props, state } from 'cerebral'

const Ruler = connect(
  {
    ruler: `workspace.rulers.${props`id`}`
  },
  ({ ruler, scale }) => (
    <line
      x1={ruler.orientation === 'horizontal' ? 0 : ruler.position.x * scale}
      y1={ruler.orientation === 'horizontal' ? ruler.position.y * scale : 0}
      x2={
        ruler.orientation === 'horizontal' ? '100%' : ruler.position.x * scale
      }
      y2={
        ruler.orientation === 'horizontal' ? ruler.position.y * scale : '100%'
      }
      strokeWidth="1"
      stroke="red"
    />
  )
)

export default Ruler
