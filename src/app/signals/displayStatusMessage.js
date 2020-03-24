export default [function ({props, state}) {
   state.set(state`workspace.status`, `${state.message}`)
}]