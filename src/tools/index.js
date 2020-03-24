// @flow
import lineAdded from './signals/lineAdded'
import toolActivated from './signals/toolActivated'
import state from './state'

import { Circle } from './components/Circle'
import { Clone } from './components/Clone'
import { Image } from './components/Image'
import { Line } from './components/Line'
import { Move } from './components/Move'
import { Pen } from './components/Pen'
import { Rectangle } from './components/Rectangle'
import { Select } from './components/Select'
import { Text } from './components/Text'
import { Zoom } from './components/Zoom'

export { Circle, Clone, Image, Line, Move, Pen, Rectangle, Select, Text, Zoom }

export default {
  state: state,

  // Add signals
  signals: {
    toolActivated,
    lineAdded
  },

  // Add services
  providers: {
    hello() {
      console.log('hello from tool service')
    }
  }
}
