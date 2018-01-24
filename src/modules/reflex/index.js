/* @flow */
import dragging from './signals/dragging'
import endDragging from './signals/endDragging'
import startDragging from './signals/startDragging'
import state from './state'

export default {
    signals: {
        startDragging,
        dragging,
        endDragging
    },
    state: state,
    services: {
        hello() {
            console.log('hello from service')
        }
    }
}