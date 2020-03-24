import deactivateTools from '../actions/deactivateTools'
import displayStatusMessage from '../actions/displayStatusMessage'
import toggleActiveTool from '../actions/toggleActiveTool'
import resetState from '../../modules/reflex/actions/resetState'
import { set } from 'cerebral/operators'
import { props, state } from 'cerebral'

export default [
  resetState,
  // deactivateTools,
  toggleActiveTool,
  set(state`ui.controls.contextmenu.visible`, false),
  displayStatusMessage
]
