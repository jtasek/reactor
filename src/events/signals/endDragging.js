/* @flow */
import { set } from 'cerebral/operators'
import { props, state } from 'cerebral'

import resetState from '../actions/resetState'
import setPosition from '../actions/setPosition'
import executeToolCommand from '../actions/executeToolCommand'

export default [
  set(state`flex.monitor.dragging`, false),
  executeToolCommand
  //resetState
]
