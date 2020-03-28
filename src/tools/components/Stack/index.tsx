import React from 'react'
import activeTools from '../../computed/activeTools'

// Connected components
import Circle from '../Circle'
import Clone from '../Clone'
import Image from '../Image'
import Line from '../Line'
import Move from '../Move'
import Pen from '../Pen'
import Rectangle from '../Rectangle'
import Select from '../Select'
import Text from '../Text'
import Zoom from '../Zoom'

const components = {
  Circle,
  Clone,
  Image,
  Line,
  Move,
  Pen,
  Rectangle,
  Select,
  Text,
  Zoom
}

const renderTools = tools => {
  tools.map(tool => components[tool])
}

function getComponentByType(type: string) {
  return components[type]
}

const Stack = ({ tools }) => {
console.dir(tools)
return (
  <g id="tools">
    {tools.map(tool => React.createElement(getComponentByType(tool), { key: tool }))}
  </g>
)
}

export default connect(
  {
    tools: activeTools
  },
  Stack
)
