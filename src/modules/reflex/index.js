// @flow
import dragging from './signals/dragging'
import endDragging from './signals/endDragging'
import startDragging from './signals/startDragging'
import state from './state'

export default Module({
  signals: {
    startDragging,
    dragging,
    endDragging
  },
  state: state,
  providers: {
    hello() {
      console.log('hello from service')
    }
  }
})
