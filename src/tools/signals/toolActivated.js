import deactivateTools from '../actions/deactivateTools';
import displayStatusMessage from '../actions/displayStatusMessage';
import toggleActiveTool from '../actions/toggleActiveTool';
import resetState from '../../reflex/actions/resetState';

export default [
  resetState,
  // deactivateTools,
  toggleActiveTool,
  set(state`ui.controls.contextmenu.visible`, false),
  displayStatusMessage
];
