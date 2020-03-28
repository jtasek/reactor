export default ({props, state}) => {
  state.set(`workspace.links.${props.id}.selected`, true)
}