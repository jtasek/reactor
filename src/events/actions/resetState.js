
import resetstate from '../state'

export default ({ state }) => {
  state.merge('reflex', resetstate)
  // console.log(state.get('reflex.monitor'))
  //  state.splice('reflex.monitor.path', 0, 1000000)
}
