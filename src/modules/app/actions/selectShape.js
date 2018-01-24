export default ({props, state}) => {
  state.set(`workspace.shapes.${props.id}.selected`, true)
}