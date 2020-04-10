import resetState from '../actions/resetState';
import setPosition from '../actions/setPosition';
import setInitialPosition from '../actions/setInitialPosition';
import updatePath from '../actions/updatePath';

export default [
  resetState,
  set(state`reflex.monitor.dragging`, true),
  setInitialPosition,
  setPosition,
  updatePath
];
