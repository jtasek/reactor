// @flow
import React, { Component } from 'react'
//import Shape from '../Shape'
import Grid from '../Grid'
import Ruler from '../Ruler'
import { connect } from '@cerebral/react'
import { props, state } from 'cerebral'
import Stack from '../../../tools/components/Stack'
import shapes from '../../../app/computed/shapesWithType'
import styles from './styles.css'

//import collect from './collect'
import {
  Circle as circle,
  Clone as clone,
  //   Image as image,
  Line as line,
  Move as move,
  Pen as pen,
  Rectangle as rect,
  Select as select,
  Text as text,
  Zoom as zoom
} from '../../../tools/index.js'

const components = {
  circle,
  clone,
  //    image,
  line,
  move,
  pen,
  rect,
  select,
  text,
  zoom
}

function getComponentByType(type: string) {
  return components[type]
}

const Rulers = connect(
  {
    rulers: state`workspace.rulers`
  },
  ({ rulers }) => (
    <g id="rulers">
      {/*{rulers.map(ruler => <Ruler key={ruler.id} {...ruler} scale={1} />)}*/}
    </g>
  )
)

const Shapes = connect(
  {
    shapes: shapes
  },
  ({ shapes }) => (
    <g id="shapes">
      {shapes.map(shape =>
        React.createElement(
          getComponentByType(shape.type),
          Object.assign({
            key: shape.id,
            id: shape.id,
            color: 'rgba(255,255,255,.5)'
          })
        )
      )}
    </g>
  )
)

export const MinimapPanel = ({ visible }) => (
  <svg
    className={styles.minimapPanel}
    width="200"
    height="200"
    viewBox="0 0 1000 1000"
    style={!visible ? { display: 'none' } : { display: 'block' }}
  >
    <Grid key="map-grid" />
    {/* <Rulers /> */}
    <Shapes />
    {/* <Stack /> */}
  </svg>
)

export default connect(
  {
    visible: state`ui.controls.minimappanel.visible`
  },
  MinimapPanel
)
