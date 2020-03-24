/* @flow */
import { createShape } from '../../../app/factories'
// import getPosition from '../computed/getPosition'
// import getSize from '../computed/getSize'

// Component factories
import { createCircle as circle } from '../../tools/components/Circle'
//import {clone} from '../../tools/components/Clone'
//import {image} from '../../tools/components/Image'
import { createLine as line } from '../../tools/components/Line'
//import {move} from '../../tools/components/Move'
import { createPen as pen } from '../../tools/components/Pen'
import { createRectangle as rect } from '../../tools/components/Rectangle'
//import {select} from '../../tools/components/Select'
import { text } from '../../tools/components/Text'
//import {zoom} from '../../tools/components/Zoom'

const factories = {
  circle,
  line,
  pen,
  rect,
  text
}

export default ({ props, state }) => {
  // Get active tools
  const tools = state.get('tools')
  const activeTools = Object.keys(tools)
    .filter(tool => tools[tool].active)
    .map(tool => tools[tool])

  // Get tool command
  for (let tool of activeTools) {
    console.log(`Execute command: ${tool.command}`)

    // Get mouse state
    const { isDragging, initialPosition, position } = state.get(
      'reflex.monitor'
    )

    const size = {
      width: Math.abs(position.x - initialPosition.x),
      height: Math.abs(position.y - initialPosition.y)
    }

    // Get factory for the specific shape type
    const keys = Object.keys(factories).filter(type => type === tool.type)

    if (typeof keys === 'undefined' || keys.length === 0)
      throw new Exception(`Type '${tool.type}' is not supported.`)

    keys
      .map(key => factories[key])
      .forEach(factory => {
        // Create new shape
        const options = factory()

        // Create shape object
        const shape = createShape(options)

        // Debug
        console.dir(shape)

        // Insert new shape into store
        state.set(`workspace.shapes.${shape.id}`, shape)
      })
  }
}
