export default ({props, state}) => {
  state.set(`workspace.layers.${props.id}.selected`, true)
}