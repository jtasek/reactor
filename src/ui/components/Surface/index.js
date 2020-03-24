// @flow
import React, { Component, PropTypes } from 'react'
import Grid from '../Grid'
import Ruler from '../Ruler'
import Handle from '../Handle'
import { connect } from '@cerebral/react'
import { sequences, state } from 'cerebral'
//import {DropTarget} from 'react-dnd'
import { findDOMNode } from 'react-dom'
import styles from './styles.css'
import { getRandomColor } from '../../../app/utils'
import rulers from '../../../app/computed/filteredRulers'
import shapes from '../../../app/computed/shapesWithType'
import Overlay from '../Overlay'
import Stack from '../../../tools/components/Stack'
import EventLayer from '../../../modules/reflex/EventLayer'
//import surfaceTarget from './surfaceTarget'
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
} from '../../../tools'

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
            color: getRandomColor()
          })
        )
      )}
    </g>
  )
)

const Rulers = connect(
  {
    rulers: rulers,
    scale: state`workspace.camera.scale`
  },
  ({ rulers, scale }) => (
    <g id="rulers">
      {rulers.map(ruler => (
        <Ruler key={ruler} id={ruler} scale={scale} />
      ))}
    </g>
  )
)

const Camera = connect(
  {
    camera: state`workspace.camera`
  },
  ({ camera, children }) => {
    return (
      <g
        transform={`translate(${camera.position.x},${camera.position.y}) scale(${camera.scale})`}
      >
        {children}
      </g>
    )
  }
)

//DropTarget('shape', surfaceTarget, collect)(
// connect({
//   tools: state`tools`,
//     contextMenuDisplayed: sequences`ui.contextMenuDisplayed`
//   },

export default EventLayer(
  connect(
    {
      contextMenuDisplayed: sequences`ui.contextMenuDisplayed`
    },
    class Surface extends Component {
      render() {
        // Your component receives its own props as usual
        const { contextMenuDisplayed } = this.props
        // These props are injected by React DnD,
        // as defined by your `collect` function above:
        //const { isOver, canDrop, connectDropTarget } = this.props;

        return (
          /*connectDropTarget(*/
          <svg
            className={styles.surface}
            onContextMenu={e => {
              e.preventDefault()
              contextMenuDisplayed({ x: e.clientX, y: e.clientY })
            }}
          >
            <Overlay />
            <Grid />
            {/* <Rulers /> */}
            <Camera>
              <Shapes />
              <Handle x={500} y={500} size={5} />
              <Handle x={600} y={500} size={5} />
              <Handle x={550} y={600} size={5} />
              <Stack />
            </Camera>
          </svg>
        )
      }
    }
  )
)
