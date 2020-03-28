export default ({props, state}) => {
  state.set(`workspaces.${props.id}.selected`, true)
}